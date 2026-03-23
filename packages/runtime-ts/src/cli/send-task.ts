#!/usr/bin/env node
import path from "node:path";
import { createAgent } from "../agent.js";

const root = path.resolve(process.argv[2] ?? ".somnicortex-agent");
const title = process.argv[3] ?? "Untitled Task";
const body = process.argv.slice(4).join(" ") || "No task body provided";
const agent = await createAgent(root);
await agent.receiveTask({
  id: `task_${Date.now().toString(36)}`,
  title,
  body,
  urgency: "normal",
  metadata: {}
});
console.log("task accepted");
await agent.shutdown();
