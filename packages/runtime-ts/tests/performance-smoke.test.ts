import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import fs from "node:fs/promises";
import Database from "better-sqlite3";
import { prefilterCandidates, rerankWithKernel, assembleContextPacket } from "../src/retrieval.js";
import { KernelSupervisor } from "../src/kernelSupervisor.js";
import { KernelClient } from "../src/kernelClient.js";

test("performance smoke: pre-filter median <1ms over 10k objects", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE episodes (id TEXT PRIMARY KEY, content TEXT, salience REAL)");
  db.exec("CREATE INDEX idx_episodes_salience ON episodes(salience DESC)");

  const insert = db.prepare("INSERT INTO episodes (id, content, salience) VALUES (?, ?, ?)");
  const tx = db.transaction(() => {
    for (let i = 0; i < 10_000; i += 1) {
      const content = i % 10 === 0 ? `memory candidate ${i}` : `filler ${i}`;
      insert.run(`ep_${i}`, content, Math.random());
    }
  });
  tx();

  // Warm cache and statement compilation.
  prefilterCandidates(db, "memory", 64);

  const samplesMs: number[] = [];
  for (let i = 0; i < 40; i += 1) {
    const started = process.hrtime.bigint();
    prefilterCandidates(db, "memory", 64);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    samplesMs.push(elapsedMs);
  }
  samplesMs.sort((a, b) => a - b);
  const median = samplesMs[Math.floor(samplesMs.length / 2)] ?? Number.POSITIVE_INFINITY;
  db.close();
  assert.ok(median < 1.0, `expected median <1ms, got ${median.toFixed(3)}ms`);
});

test("performance smoke: recall roundtrip <200ms", async () => {
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

  const db = new Database(":memory:");
  db.exec("CREATE TABLE episodes (id TEXT PRIMARY KEY, content TEXT, salience REAL)");
  const insert = db.prepare("INSERT INTO episodes (id, content, salience) VALUES (?, ?, ?)");
  const tx = db.transaction(() => {
    for (let i = 0; i < 10_000; i += 1) {
      insert.run(`ep_${i}`, `memory chunk ${i}`, Math.random());
    }
  });
  tx();

  await supervisor.start();
  try {
    const kernel = new KernelClient(address);
    const started = process.hrtime.bigint();
    const candidates = prefilterCandidates(db, "memory", 64);
    const ranked = await rerankWithKernel(kernel, "memory", candidates);
    const rankedResult = (ranked.result as Record<string, unknown>) ?? {};
    const rankedItems = (rankedResult.ranked as unknown[] | undefined) ?? [];
    const packet = assembleContextPacket(8_000, "perf-smoke", [], rankedItems, [], [], []);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    assert.equal(packet.task_focus, "perf-smoke");
    assert.ok(elapsedMs < 200, `expected roundtrip <200ms, got ${elapsedMs.toFixed(3)}ms`);
  } finally {
    db.close();
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
