import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import Database from "better-sqlite3";
import { createAgentFromBirthSpec } from "../../src/birth.js";

test("phases 6-8 core loop with birth spec, wake cycle, and micro sleep", async () => {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const tempRoot = path.join(repoRoot, ".tmp-core-loop");
  const fixturePath = path.join(repoRoot, "packages", "ipc", "fixtures", "kernel-operations.json");
  const kernelPkgPath = path.join(repoRoot, "packages", "kernel-py");
  const birthSpecPath = path.join(process.cwd(), "tests", "fixtures", "birth-spec.researcher.yaml");
  const archetypeDir = path.join(process.cwd(), "archetypes");
  const pythonBin = await resolvePythonBin();
  const port = await findFreePort();
  const address = `tcp:${port}`;

  await fs.mkdir(tempRoot, { recursive: true });
  try {
    const agent = await createAgentFromBirthSpec(tempRoot, birthSpecPath, "researcher", {
      kernelSocketPath: address,
      kernelCommand: [
        pythonBin,
        "-m",
        "somnicortex_kernel.rpc",
        "--tcp-port",
        String(port),
        "--fixture-file",
        fixturePath
      ],
      kernelWorkingDirectory: repoRoot,
      kernelEnv: {
        PYTHONPATH: kernelPkgPath,
        PATH: `${path.dirname(pythonBin)}:${process.env.PATH ?? ""}`
      },
      unknownToolPolicy: "allow"
    }, { archetypeDir });

    try {
      await agent.receive_task({
        id: "task-core-loop-1",
        title: "Analyze retrieval architecture",
        body: "Run one wake cycle with mock providers.",
        urgency: "normal",
        metadata: {}
      });

      const ledger = new Database(path.join(tempRoot, "memory", "episodic", "ledger.db"), {
        readonly: true
      });
      const count = Number(
        (ledger.prepare("SELECT COUNT(*) AS c FROM episodes").get() as { c: number }).c
      );
      ledger.close();
      assert.ok(count >= 1, "expected episodic event to be written");

      await agent.trigger_sleep("micro", 30);

      const queue = await agent.getSleepQueue();
      assert.equal(queue.length, 0, "expected sleep queue to be processed");

      const activationPath = path.join(
        tempRoot,
        "memory",
        "semantic",
        "activation_updates.json"
      );
      const activation = JSON.parse(await fs.readFile(activationPath, "utf8")) as {
        updated: number;
      };
      assert.ok(activation.updated >= 1, "expected activation updates during sleep");

      const workingDir = path.join(tempRoot, "memory", "working");
      const workingEntries = await fs.readdir(workingDir);
      assert.equal(workingEntries.length, 0, "expected working memory to clear in micro sleep");

      assert.equal(agent.get_sleep_state(), "WAKE");
    } finally {
      await agent.shutdown();
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("Could not determine port")));
      }
    });
    srv.on("error", reject);
  });
}

async function resolvePythonBin(): Promise<string> {
  const candidates = [
    "/opt/homebrew/opt/python@3.10/bin/python3.10",
    "/opt/homebrew/bin/python3.10",
    "/opt/homebrew/bin/python3",
    "python3"
  ];
  for (const candidate of candidates) {
    try {
      if (candidate.startsWith("/")) {
        await fs.access(candidate);
      }
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return "python3";
}
