#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const HELP = `Usage:
  somnicortex-inspect-agent [agentRoot]
  somnicortex-inspect-agent --agent-dir <path> [--trigger-sleep <micro|full>] [--sleep-budget-seconds <n>]

Prints current capability snapshot and pending sleep queue jobs.
Optionally triggers a sleep cycle before printing.
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }
  const parsed = parseArgs(args);
  const root = path.resolve(parsed.agentRoot ?? ".somnicortex-agent");
  const agent = await createAgent(root);
  try {
    if (parsed.triggerSleep) {
      await agent.triggerSleep(parsed.triggerSleep, parsed.sleepBudgetSeconds);
    }
    const capabilities = await agent.exposeCapabilities();
    const sleepQueue = await agent.getSleepQueue();
    console.log(
      JSON.stringify(
        { capabilities, sleepQueue, triggeredSleep: parsed.triggerSleep ?? null },
        null,
        2
      )
    );
  } finally {
    await agent.shutdown();
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`inspect-agent failed: ${message}`);
  process.exit(1);
});

function parseArgs(args: string[]): {
  agentRoot: string | undefined;
  triggerSleep: "micro" | "full" | undefined;
  sleepBudgetSeconds: number;
} {
  const hasFlags = args.some((arg) => arg.startsWith("--"));
  if (!hasFlags) {
    return { agentRoot: args[0], triggerSleep: undefined, sleepBudgetSeconds: 30 };
  }
  let agentRoot: string | undefined;
  let triggerSleep: "micro" | "full" | undefined;
  let sleepBudgetSeconds = 30;
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
    if (arg === "--trigger-sleep") {
      if (!next) {
        throw new Error("Missing value for --trigger-sleep");
      }
      if (next !== "micro" && next !== "full") {
        throw new Error(`Invalid --trigger-sleep value: ${next}`);
      }
      triggerSleep = next;
      i += 1;
      continue;
    }
    if (arg === "--sleep-budget-seconds") {
      if (!next) {
        throw new Error("Missing value for --sleep-budget-seconds");
      }
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --sleep-budget-seconds value: ${next}`);
      }
      sleepBudgetSeconds = parsed;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { agentRoot, triggerSleep, sleepBudgetSeconds };
}
