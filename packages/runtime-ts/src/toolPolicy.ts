import fs from "node:fs/promises";
import path from "node:path";
import { ToolBlockedError } from "./errors.js";
import { appendJsonl } from "./fs.js";
import type { AgentPaths } from "./types.js";

interface PolicyAction {
  action: "allow" | "block" | "require_approval";
  rateLimitPerMinute?: number;
}

type PolicyMap = Record<string, PolicyAction>;

export async function checkToolPolicy(
  paths: AgentPaths,
  toolName: string,
  fallback: "allow" | "block"
): Promise<PolicyAction> {
  const policyPath = path.join(paths.root, "tools", "tool_policies.yaml");
  let policy: PolicyMap = {};
  try {
    const txt = await fs.readFile(policyPath, "utf8");
    // Tiny parser for key: action pairs to keep runtime dependency-light.
    policy = parseSimplePolicyYaml(txt);
  } catch {
    policy = {};
  }

  const decision = policy[toolName] ?? { action: fallback };
  if (decision.action === "block") {
    await appendJsonl(path.join(paths.audit, "decisions.log"), {
      eventType: "tool_blocked",
      toolName,
      timestamp: new Date().toISOString()
    });
    throw new ToolBlockedError(`tool '${toolName}' is blocked`);
  }
  return decision;
}

function parseSimplePolicyYaml(raw: string): PolicyMap {
  const out: PolicyMap = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const [name, action] = trimmed.split(":").map((s) => s.trim());
    if (name && action && (action === "allow" || action === "block" || action === "require_approval")) {
      out[name] = { action };
    }
  }
  return out;
}
