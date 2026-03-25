#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { exists } from "../fs.js";

const HELP = `Usage:
  somnicortex-send-task [agentRoot] [title] [body...]
  somnicortex-send-task --agent-dir <path> --task <text> [--urgency <low|normal|high|critical>] [--timeout-ms <ms>]

Submits a task to a running runtime process and waits for completion.

Examples:
  somnicortex-send-task .somnicortex-agent "Review design" "Compare two API options"
  somnicortex-send-task --agent-dir apps/somni/.agent --task "Summarize latest audit logs" --urgency normal
`;

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
  const outboxDir = path.join(runtimeDir, "outbox");
  const statePath = path.join(runtimeDir, "state.json");
  const heartbeatPath = path.join(runtimeDir, "heartbeat.json");

  if (!(await exists(statePath))) {
    throw new Error(`Runtime is not running for ${root}. Start it first (for example: make start).`);
  }

  const requestId = `req_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const taskId = `task_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  await fs.mkdir(inboxDir, { recursive: true });
  await fs.mkdir(outboxDir, { recursive: true });
  await fs.writeFile(
    path.join(inboxDir, `${requestId}.json`),
    `${JSON.stringify(
      {
        requestId,
        task: {
          id: taskId,
          title: parsed.title,
          body: parsed.body,
          urgency: parsed.urgency,
          metadata: {}
        },
        submittedAt: new Date().toISOString()
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const deadline = Date.now() + parsed.timeoutMs;
  const responsePath = path.join(outboxDir, `${requestId}.json`);
  while (Date.now() < deadline) {
    if (await exists(responsePath)) {
      const raw = await fs.readFile(responsePath, "utf8");
      await fs.rm(responsePath, { force: true });
      const response = JSON.parse(raw) as {
        status: "completed" | "failed";
        error?: string;
      };
      if (response.status === "failed") {
        throw new Error(response.error ?? "task failed");
      }
      console.log("task accepted");
      return;
    }
    if (!(await exists(statePath))) {
      throw new Error("Runtime stopped before task completed.");
    }
    await ensureHeartbeatFresh(heartbeatPath);
    await sleep(150);
  }
  throw new Error(
    `Timed out waiting for runtime response after ${parsed.timeoutMs}ms. ` +
      "The task may still complete; check audit/reports/cycle.log."
  );
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`send-task failed: ${message}`);
  process.exit(1);
});

function parseArgs(args: string[]): {
  agentRoot: string | undefined;
  title: string;
  body: string;
  urgency: "low" | "normal" | "high" | "critical";
  timeoutMs: number;
} {
  const hasFlags = args.some((arg) => arg.startsWith("--"));
  if (!hasFlags) {
    return {
      agentRoot: args[0],
      title: args[1] ?? "Untitled Task",
      body: args.slice(2).join(" ") || "No task body provided",
      urgency: "normal",
      timeoutMs: 60_000
    };
  }

  let agentRoot: string | undefined;
  let task = "";
  let urgency: "low" | "normal" | "high" | "critical" = "normal";
  let timeoutMs = 60_000;
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
    if (arg === "--task") {
      if (!next) {
        throw new Error("Missing value for --task");
      }
      task = next;
      i += 1;
      continue;
    }
    if (arg === "--urgency") {
      if (!next) {
        throw new Error("Missing value for --urgency");
      }
      if (next === "low" || next === "normal" || next === "high" || next === "critical") {
        urgency = next;
      } else {
        throw new Error(`Invalid --urgency value: ${next}`);
      }
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      if (!next) {
        throw new Error("Missing value for --timeout-ms");
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout-ms value: ${next}`);
      }
      timeoutMs = parsed;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const normalizedTask = task || "Untitled Task";
  return {
    agentRoot,
    title: normalizedTask,
    body: normalizedTask,
    urgency,
    timeoutMs
  };
}

async function ensureHeartbeatFresh(heartbeatPath: string): Promise<void> {
  if (!(await exists(heartbeatPath))) {
    return;
  }
  const raw = await fs.readFile(heartbeatPath, "utf8");
  const parsed = JSON.parse(raw) as { updatedAt?: string };
  if (!parsed.updatedAt) {
    return;
  }
  const ageMs = Date.now() - new Date(parsed.updatedAt).getTime();
  if (Number.isFinite(ageMs) && ageMs > 30_000) {
    throw new Error("Runtime heartbeat is stale. Restart the runtime with `make start`.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
