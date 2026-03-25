#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const HELP = `Usage:
  somnicortex-inspect-agent [agentRoot]

Prints current capability snapshot and pending sleep queue jobs.
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
    const capabilities = await agent.exposeCapabilities();
    const sleepQueue = await agent.getSleepQueue();
    console.log(JSON.stringify({ capabilities, sleepQueue }, null, 2));
  } finally {
    await agent.shutdown();
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`inspect-agent failed: ${message}`);
  process.exit(1);
});
