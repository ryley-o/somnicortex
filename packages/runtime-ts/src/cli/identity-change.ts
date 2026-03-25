#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { appendIdentityEntry } from "../identity.js";
import { exists, writeJsonAtomic } from "../fs.js";
import { deriveAgentPaths } from "../substrate.js";
import { proposeApproval } from "../approval.js";

const HELP = `Usage:
  somnicortex-identity-change --agent-dir <path> --scope <personality|identity_metadata> --change '<json>'

Proposes an identity governance change for manual testing.
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    return;
  }

  const parsed = parseArgs(args);
  const agentRoot = path.resolve(parsed.agentDir);
  const paths = deriveAgentPaths(agentRoot);
  const agentYamlPath = path.join(paths.root, "agent.yaml");
  if (!(await exists(agentYamlPath))) {
    throw new Error(`Agent does not appear initialized at ${agentRoot} (missing agent.yaml).`);
  }

  if (parsed.scope === "personality") {
    const proposal = await proposeApproval(paths, "identity.personality", parsed.change);
    await setSleepState(paths, "SUPERVISED_PAUSE");
    await updateAgentYamlSleepState(agentYamlPath, "SUPERVISED_PAUSE");
    console.log(
      JSON.stringify(
        {
          scope: parsed.scope,
          requiresApproval: true,
          approvalId: proposal.requestId,
          pendingApprovalPath: proposal.requestPath,
          sleepState: "SUPERVISED_PAUSE"
        },
        null,
        2
      )
    );
    return;
  }

  await appendIdentityEntry(
    paths,
    "identity_metadata",
    parsed.change,
    "human_operator",
    true
  );
  console.log(
    JSON.stringify(
      {
        scope: parsed.scope,
        requiresApproval: false,
        approvalId: null,
        pendingApprovalPath: null,
        applied: true
      },
      null,
      2
    )
  );
}

function parseArgs(args: string[]): {
  agentDir: string;
  scope: "personality" | "identity_metadata";
  change: Record<string, unknown>;
} {
  let agentDir = "";
  let scope: "personality" | "identity_metadata" | undefined;
  let changeRaw = "";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--agent-dir") {
      if (!next) {
        throw new Error("Missing value for --agent-dir");
      }
      agentDir = next;
      i += 1;
      continue;
    }
    if (arg === "--scope") {
      if (!next) {
        throw new Error("Missing value for --scope");
      }
      if (next !== "personality" && next !== "identity_metadata") {
        throw new Error(`Invalid --scope value: ${next}`);
      }
      scope = next;
      i += 1;
      continue;
    }
    if (arg === "--change") {
      if (!next) {
        throw new Error("Missing value for --change");
      }
      changeRaw = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!agentDir) {
    throw new Error("Missing required --agent-dir");
  }
  if (!scope) {
    throw new Error("Missing required --scope");
  }
  if (!changeRaw) {
    throw new Error("Missing required --change");
  }

  let parsedChange: unknown;
  try {
    parsedChange = JSON.parse(changeRaw);
  } catch {
    throw new Error("--change must be a valid JSON object string");
  }
  if (!parsedChange || typeof parsedChange !== "object" || Array.isArray(parsedChange)) {
    throw new Error("--change must decode to a JSON object");
  }

  return {
    agentDir,
    scope,
    change: parsedChange as Record<string, unknown>
  };
}

async function setSleepState(
  paths: ReturnType<typeof deriveAgentPaths>,
  state: "SUPERVISED_PAUSE"
): Promise<void> {
  await writeJsonAtomic(path.join(paths.sleep, "state.json"), { state });
}

async function updateAgentYamlSleepState(agentYamlPath: string, state: "SUPERVISED_PAUSE"): Promise<void> {
  const raw = await fs.readFile(agentYamlPath, "utf8");
  const lines = raw.split("\n");
  const nextLines = lines.map((line) =>
    line.startsWith("sleep_state:") ? `sleep_state: ${state}` : line
  );
  await fs.writeFile(agentYamlPath, nextLines.join("\n"), "utf8");
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`identity-change failed: ${message}`);
  console.error("Use --help for usage.");
  process.exit(1);
});
