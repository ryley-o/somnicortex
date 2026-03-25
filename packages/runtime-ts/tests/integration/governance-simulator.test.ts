import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import { createAgentFromBirthSpec } from "../../src/birth.js";
import { deriveAgentPaths } from "../../src/substrate.js";
import { verifyIdentitySnapshot } from "../../src/identity.js";

test("governance approval flow + full sleep simulator outputs", async () => {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const tempRoot = path.join(repoRoot, ".tmp-governance-sim");
  const fixturePath = path.join(repoRoot, "packages", "ipc", "fixtures", "kernel-operations.json");
  const kernelPkgPath = path.join(repoRoot, "packages", "kernel-py");
  const birthSpecPath = path.join(process.cwd(), "tests", "fixtures", "birth-spec.researcher.yaml");
  const archetypeDir = path.join(process.cwd(), "archetypes");
  const pythonBin = await resolvePythonBin();
  const port = await findFreePort();
  const address = `tcp:${port}`;

  await fs.mkdir(tempRoot, { recursive: true });
  try {
    const agent = await createAgentFromBirthSpec(
      tempRoot,
      birthSpecPath,
      "researcher",
      {
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
        approvalPollMs: 30,
        approvalTimeoutMs: 4_000,
        unknownToolPolicy: "allow"
      },
      { archetypeDir }
    );

    try {
      const changePromise = agent.applyIdentityChange("personality", {
        tone: "reflective",
        riskTolerance: "low"
      });

      const approvalPath = await waitForPendingApproval(tempRoot);
      assert.equal(agent.get_sleep_state(), "SUPERVISED_PAUSE");

      const approvalRaw = await fs.readFile(approvalPath, "utf8");
      const approval = JSON.parse(approvalRaw) as Record<string, unknown>;
      approval.status = "approved";
      approval.reviewer = "human_operator";
      approval.reason = "Alignment validated";
      approval.decidedAt = new Date().toISOString();
      await fs.writeFile(approvalPath, `${JSON.stringify(approval, null, 2)}\n`, "utf8");

      await changePromise;
      assert.equal(agent.get_sleep_state(), "WAKE");
      assert.equal(
        await verifyIdentitySnapshot(deriveAgentPaths(tempRoot)),
        true,
        "identity hash chain should verify after approved update"
      );

      await agent.trigger_sleep("full", 45);
      assert.equal(agent.get_sleep_state(), "WAKE");

      const dreamsDir = path.join(tempRoot, "sleep", "dreams");
      const dreamFiles = (await fs.readdir(dreamsDir)).filter((f) => f.endsWith(".json"));
      assert.ok(dreamFiles.length >= 1, "full sleep should emit at least one dream");
      const dream = JSON.parse(
        await fs.readFile(path.join(dreamsDir, dreamFiles[0] ?? ""), "utf8")
      ) as Record<string, unknown>;
      assert.equal(dream.mode, "default_mode_simulator");
      assert.ok(dream.gapAnalysis, "dream should include gap analysis");
      assert.ok(dream.planSketch, "dream should include plan sketch");
      assert.ok(dream.counterfactualReplay, "dream should include counterfactual replay");
      const promotionProtocol = dream.promotionProtocol as { blockedDestinations?: string[] };
      assert.ok(
        Array.isArray(promotionProtocol.blockedDestinations) &&
          promotionProtocol.blockedDestinations.includes("values") &&
          promotionProtocol.blockedDestinations.includes("identity"),
        "promotion protocol must block values/identity destinations"
      );
    } finally {
      await agent.shutdown();
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

async function waitForPendingApproval(tempRoot: string): Promise<string> {
  const dir = path.join(tempRoot, "audit", "pending_approvals");
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    if (files.length) {
      return path.join(dir, files[0] ?? "");
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("approval request file did not appear in time");
}

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
