#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const root = path.resolve(process.argv[2] ?? ".somnicortex-agent");
const agent = await createAgent(root);
console.log(JSON.stringify({ agentRoot: root, sleepState: agent.getSleepState() }, null, 2));
await agent.shutdown();
