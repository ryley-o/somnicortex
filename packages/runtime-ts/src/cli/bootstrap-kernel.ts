#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const HELP = `Usage:
  somnicortex-bootstrap-kernel [agentRoot]

Bootstraps and validates kernel connectivity, then prints capability metadata.
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
    console.log(
      JSON.stringify(
        {
          bootstrapped: true,
          kernelVersion: capabilities.kernelVersion,
          supportedOperations: capabilities.supportedOperations
        },
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
  console.error(`bootstrap-kernel failed: ${message}`);
  process.exit(1);
});
