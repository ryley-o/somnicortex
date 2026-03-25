#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import type { TaskSpec } from "@somnicortex/ipc";
import { createAgent } from "../agent.js";
import { exists } from "../fs.js";

const HELP = `Usage:
  somnicortex-start-runtime [agentRoot]
  somnicortex-start-runtime --agent-dir <path> [--poll-ms <ms>]

Starts a long-running runtime process that consumes queued tasks from:
  <agentRoot>/runtime/inbox/*.json
and writes responses to:
  <agentRoot>/runtime/outbox/*.json
`;

interface RuntimeRequest {
  requestId: string;
  task: TaskSpec;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const parsed = parseArgs(args);
  const root = path.resolve(parsed.agentRoot ?? ".somnicortex-agent");
  const runtimeDir = path.join(root, "runtime");
  const inboxDir = path.join(runtimeDir, "inbox");
  const processingDir = path.join(runtimeDir, "processing");
  const outboxDir = path.join(runtimeDir, "outbox");
  const statePath = path.join(runtimeDir, "state.json");
  const heartbeatPath = path.join(runtimeDir, "heartbeat.json");

  await fs.mkdir(inboxDir, { recursive: true });
  await fs.mkdir(processingDir, { recursive: true });
  await fs.mkdir(outboxDir, { recursive: true });

  const agent = await createAgent(root);
  let running = true;
  const shutdown = async (signal: string): Promise<void> => {
    if (!running) {
      return;
    }
    running = false;
    await fs.rm(statePath, { force: true });
    await agent.shutdown();
    console.log(`runtime stopped (${signal})`);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await fs.writeFile(
    statePath,
    `${JSON.stringify(
      {
        pid: process.pid,
        agentRoot: root,
        startedAt: new Date().toISOString(),
        pollMs: parsed.pollMs
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  console.log(`runtime started for ${root}`);

  while (running) {
    await fs.writeFile(
      heartbeatPath,
      `${JSON.stringify({ pid: process.pid, updatedAt: new Date().toISOString() })}\n`,
      "utf8"
    );
    await processInbox(inboxDir, processingDir, outboxDir, root, agent);
    await sleep(parsed.pollMs);
  }
}

async function processInbox(
  inboxDir: string,
  processingDir: string,
  outboxDir: string,
  agentRoot: string,
  agent: Awaited<ReturnType<typeof createAgent>>
): Promise<void> {
  const entries = (await fs.readdir(inboxDir))
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const entry of entries) {
    const sourcePath = path.join(inboxDir, entry);
    const processingPath = path.join(processingDir, entry);
    try {
      await fs.rename(sourcePath, processingPath);
    } catch {
      continue;
    }

    let requestId = entry.replace(/\.json$/, "");
    try {
      const raw = await fs.readFile(processingPath, "utf8");
      const request = JSON.parse(raw) as RuntimeRequest;
      if (!request.requestId || !request.task || !request.task.id) {
        throw new Error("Invalid task payload");
      }
      requestId = request.requestId;
      await agent.receiveTask(request.task);
      const report = await readLatestTaskReport(agentRoot, request.task.id);
      await writeResponse(outboxDir, requestId, {
        status: "completed",
        taskId: request.task.id,
        completedAt: new Date().toISOString(),
        report
      });
    } catch (error) {
      await writeResponse(outboxDir, requestId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString()
      });
    } finally {
      await fs.rm(processingPath, { force: true });
    }
  }
}

async function readLatestTaskReport(
  agentRoot: string,
  taskId: string
): Promise<Record<string, unknown> | null> {
  const reportPath = path.join(agentRoot, "audit", "reports", "cycle.log");
  if (!(await exists(reportPath))) {
    return null;
  }
  const raw = await fs.readFile(reportPath, "utf8");
  const lines = raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      if (parsed.taskId === taskId) {
        return parsed;
      }
    } catch {
      // Skip malformed report lines.
    }
  }
  return null;
}

async function writeResponse(
  outboxDir: string,
  requestId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await fs.writeFile(path.join(outboxDir, `${requestId}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function parseArgs(args: string[]): {
  agentRoot: string | undefined;
  pollMs: number;
} {
  const hasFlags = args.some((arg) => arg.startsWith("--"));
  if (!hasFlags) {
    return { agentRoot: args[0], pollMs: 200 };
  }
  let agentRoot: string | undefined;
  let pollMs = 200;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--agent-dir") {
      if (!next) {
        throw new Error("Missing value for --agent-dir");
      }
      agentRoot = next;
      i += 1;
      continue;
    }
    if (arg === "--poll-ms") {
      if (!next) {
        throw new Error("Missing value for --poll-ms");
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --poll-ms value: ${next}`);
      }
      pollMs = parsed;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { agentRoot, pollMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`start-runtime failed: ${message}`);
  process.exit(1);
});
