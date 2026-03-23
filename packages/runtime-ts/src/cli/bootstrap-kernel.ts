#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const root = path.resolve(process.argv[2] ?? ".somnicortex-agent");
const agent = await createAgent(root);
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
await agent.shutdown();
