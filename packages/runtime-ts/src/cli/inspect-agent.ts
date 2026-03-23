#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const root = path.resolve(process.argv[2] ?? ".somnicortex-agent");
const agent = await createAgent(root);
const capabilities = await agent.exposeCapabilities();
const sleepQueue = await agent.getSleepQueue();
console.log(JSON.stringify({ capabilities, sleepQueue }, null, 2));
await agent.shutdown();
