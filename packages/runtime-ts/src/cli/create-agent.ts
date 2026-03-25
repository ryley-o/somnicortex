#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const HELP = `Usage:
  somnicortex-create-agent [agentRoot]

Creates (or opens) an agent root and ensures substrate/kernel are ready.

Examples:
  somnicortex-create-agent
  somnicortex-create-agent .somnicortex-agent
`;

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg === "--help" || arg === "-h") {
    console.log(HELP);
    return;
  }

  const root = path.resolve(arg ?? ".somnicortex-agent");
  const agent = await createAgent(root);
  try {
    console.log(JSON.stringify({ agentRoot: root, sleepState: agent.getSleepState() }, null, 2));
  } finally {
    await agent.shutdown();
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`create-agent failed: ${message}`);
  process.exit(1);
});
