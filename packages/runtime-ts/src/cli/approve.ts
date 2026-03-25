#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { appendIdentityEntry } from "../identity.js";
import { deriveAgentPaths } from "../substrate.js";
import { writeJsonAtomic } from "../fs.js";

const HELP = `Usage:
  somnicortex-approve [agentRoot] <requestId> [approved|rejected] [reviewer]
  somnicortex-approve --agent-dir <path> --list
  somnicortex-approve --agent-dir <path> --approve <requestId> [--reviewer <name>]
  somnicortex-approve --agent-dir <path> --reject <requestId> [--reason <text>] [--reviewer <name>]

Writes an approval decision into the pending approval file transport.
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const parsed = parseArgs(args);
  const agentRoot = path.resolve(parsed.agentRoot);
  if (parsed.command === "list") {
    await listPendingApprovals(agentRoot);
    return;
  }

  const requestId = parsed.requestId;
  const decision = parsed.command === "approve" ? "approved" : "rejected";
  const reviewer = parsed.reviewer;

  const pendingPath = path.join(agentRoot, "audit", "pending_approvals", `${requestId}.json`);
  const raw = await fs.readFile(pendingPath, "utf8");
  const value = JSON.parse(raw) as Record<string, unknown>;
  value.status = decision;
  value.reviewer = reviewer;
  value.decidedAt = new Date().toISOString();
  if (parsed.command === "reject" && parsed.reason) {
    value.reason = parsed.reason;
  }
  await fs.writeFile(pendingPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

  await maybeFinalizeIdentityGovernance(agentRoot, value, decision);
  console.log(`approval ${decision}: ${requestId}`);
}

function parseArgs(args: string[]): {
  command: "list" | "approve" | "reject";
  agentRoot: string;
  requestId: string;
  reviewer: string;
  reason: string | undefined;
} {
  const hasFlags = args.some((arg) => arg.startsWith("--"));
  if (!hasFlags) {
    const agentRoot = args[0] ?? ".somnicortex-agent";
    const requestId = args[1];
    const decision = (args[2] ?? "approved") as "approved" | "rejected";
    const reviewer = args[3] ?? "operator";
    if (!requestId) {
      throw new Error("missing <requestId>");
    }
    if (decision !== "approved" && decision !== "rejected") {
      throw new Error(`decision must be approved|rejected, got ${decision}`);
    }
    return {
      command: decision === "approved" ? "approve" : "reject",
      agentRoot,
      requestId,
      reviewer,
      reason: undefined
    };
  }

  let agentRoot = ".somnicortex-agent";
  let command: "list" | "approve" | "reject" | undefined;
  let requestId = "";
  let reviewer = "operator";
  let reason: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--agent-dir") {
      if (!next) {
        throw new Error("Missing value for --agent-dir");
      }
      agentRoot = next;
      i += 1;
      continue;
    }
    if (arg === "--list") {
      command = "list";
      continue;
    }
    if (arg === "--approve") {
      if (!next) {
        throw new Error("Missing value for --approve");
      }
      command = "approve";
      requestId = next;
      i += 1;
      continue;
    }
    if (arg === "--reject") {
      if (!next) {
        throw new Error("Missing value for --reject");
      }
      command = "reject";
      requestId = next;
      i += 1;
      continue;
    }
    if (arg === "--reviewer") {
      if (!next) {
        throw new Error("Missing value for --reviewer");
      }
      reviewer = next;
      i += 1;
      continue;
    }
    if (arg === "--reason") {
      if (!next) {
        throw new Error("Missing value for --reason");
      }
      reason = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!command) {
    throw new Error("Missing command: use --list, --approve <id>, or --reject <id>");
  }
  if (command !== "list" && !requestId) {
    throw new Error("Missing approval id");
  }
  return { command, agentRoot, requestId, reviewer, reason };
}

async function listPendingApprovals(agentRoot: string): Promise<void> {
  const dir = path.join(agentRoot, "audit", "pending_approvals");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const out: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    out.push({
      requestId: parsed.requestId ?? file.replace(/\.json$/, ""),
      scope: parsed.scope ?? null,
      status: parsed.status ?? null,
      path: fullPath
    });
  }
  console.log(JSON.stringify({ pending: out }, null, 2));
}

async function maybeFinalizeIdentityGovernance(
  agentRoot: string,
  approval: Record<string, unknown>,
  decision: "approved" | "rejected"
): Promise<void> {
  const scope = approval.scope;
  if (scope !== "identity.personality") {
    return;
  }
  const paths = deriveAgentPaths(agentRoot);
  if (decision === "approved") {
    const payload =
      approval.payload && typeof approval.payload === "object" && !Array.isArray(approval.payload)
        ? (approval.payload as Record<string, unknown>)
        : {};
    await appendIdentityEntry(paths, "personality", payload, "agent", true);
  }
  await writeJsonAtomic(path.join(paths.sleep, "state.json"), { state: "WAKE" });
  await syncSleepStateToAgentYaml(path.join(agentRoot, "agent.yaml"), "WAKE");
}

async function syncSleepStateToAgentYaml(agentYamlPath: string, state: "WAKE"): Promise<void> {
  const raw = await fs.readFile(agentYamlPath, "utf8");
  const lines = raw.split("\n");
  const nextLines = lines.map((line) => (line.startsWith("sleep_state:") ? `sleep_state: ${state}` : line));
  await fs.writeFile(agentYamlPath, nextLines.join("\n"), "utf8");
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`approve failed: ${message}`);
  console.error("Use --help for usage.");
  process.exit(1);
});
