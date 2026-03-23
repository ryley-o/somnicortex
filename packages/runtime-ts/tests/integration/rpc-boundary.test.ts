import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import { OperationResponseSchema } from "@somnicortex/ipc";
import { KernelSupervisor } from "../../src/kernelSupervisor.js";
import { KernelClient } from "../../src/kernelClient.js";

test("runtime crosses process boundary with classify_store RPC", async () => {
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const fixturePath = path.join(repoRoot, "packages", "ipc", "fixtures", "kernel-operations.json");
  const kernelPkgPath = path.join(repoRoot, "packages", "kernel-py");
  const pythonBin = await resolvePythonBin();
  const port = await findFreePort();
  const address = `tcp:${port}`;

  const supervisor = new KernelSupervisor(
    [
      pythonBin,
      "-m",
      "somnicortex_kernel.rpc",
      "--tcp-port",
      String(port),
      "--fixture-file",
      fixturePath
    ],
    address,
    {
      cwd: repoRoot,
      env: {
        PYTHONPATH: kernelPkgPath,
        PATH: `${path.dirname(pythonBin)}:${process.env.PATH ?? ""}`
      }
    }
  );

  await supervisor.start();
  try {
    const client = new KernelClient(address);
    const response = await client.operation({
      operation: "classify_store",
      payload: { text: "Memory consolidation candidate." }
    });
    const parsed = OperationResponseSchema.parse(response);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.operation, "classify_store");
  } finally {
    await supervisor.stop();
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
