#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const HELP = `Usage:
  somnicortex-send-task [agentRoot] [title] [body...]

Sends one task into the agent wake cycle.

Examples:
  somnicortex-send-task .somnicortex-agent "Review design" "Compare two API options"
  somnicortex-send-task "Quick note" "Track this for later"
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const root = path.resolve(args[0] ?? ".somnicortex-agent");
  const title = args[1] ?? "Untitled Task";
  const body = args.slice(2).join(" ") || "No task body provided";
  const agent = await createAgent(root);
  try {
    await agent.receiveTask({
      id: `task_${Date.now().toString(36)}`,
      title,
      body,
      urgency: "normal",
      metadata: {}
    });
    console.log("task accepted");
  } finally {
    await agent.shutdown();
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`send-task failed: ${message}`);
  process.exit(1);
});
