#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const HELP = `Usage:
  somnicortex-approve [agentRoot] <requestId> [approved|rejected] [reviewer]

Writes an approval decision into the pending approval file transport.
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const agentRoot = path.resolve(args[0] ?? ".somnicortex-agent");
  const requestId = args[1];
  const decision = (args[2] ?? "approved") as "approved" | "rejected";
  const reviewer = args[3] ?? "operator";

  if (!requestId) {
    throw new Error("missing <requestId>");
  }
  if (decision !== "approved" && decision !== "rejected") {
    throw new Error(`decision must be approved|rejected, got ${decision}`);
  }

  const pendingPath = path.join(agentRoot, "audit", "pending_approvals", `${requestId}.json`);
  const raw = await fs.readFile(pendingPath, "utf8");
  const value = JSON.parse(raw) as Record<string, unknown>;
  value.status = decision;
  value.reviewer = reviewer;
  value.decidedAt = new Date().toISOString();
  await fs.writeFile(pendingPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(`approval ${decision}: ${requestId}`);
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`approve failed: ${message}`);
  console.error("Use --help for usage.");
  process.exit(1);
});
