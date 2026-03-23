#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const agentRoot = path.resolve(process.argv[2] ?? ".somnicortex-agent");
const requestId = process.argv[3];
const decision = (process.argv[4] ?? "approved") as "approved" | "rejected";
const reviewer = process.argv[5] ?? "operator";

if (!requestId) {
  throw new Error("Usage: approve <agentRoot> <requestId> [approved|rejected] [reviewer]");
}

const pendingPath = path.join(agentRoot, "audit", "pending_approvals", `${requestId}.json`);
const raw = await fs.readFile(pendingPath, "utf8");
const value = JSON.parse(raw) as Record<string, unknown>;
value.status = decision;
value.reviewer = reviewer;
value.decidedAt = new Date().toISOString();
await fs.writeFile(pendingPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
console.log(`approval ${decision}: ${requestId}`);
