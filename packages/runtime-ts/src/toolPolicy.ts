import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { ToolBlockedError } from "./errors.js";
import { appendJsonl } from "./fs.js";
import type { AgentPaths } from "./types.js";

interface PolicyAction {
  action: "allow" | "block" | "require_approval";
  rateLimitPerMinute?: number;
}

type PolicyMap = Record<string, PolicyAction>;

interface ParsedPolicy {
  tools: PolicyMap;
  unknownTool?: PolicyAction["action"];
}

export async function checkToolPolicy(
  paths: AgentPaths,
  toolName: string,
  fallback: "allow" | "block"
): Promise<PolicyAction> {
  const policyPath = path.join(paths.root, "tools", "tool_policies.yaml");
  let policy: ParsedPolicy = { tools: {} };
  try {
    const txt = await fs.readFile(policyPath, "utf8");
    policy = parsePolicyYaml(txt);
  } catch {
    policy = { tools: {} };
  }

  const decision = policy.tools[toolName] ?? {
    action: policy.unknownTool ?? fallback
  };
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

function parsePolicyYaml(raw: string): ParsedPolicy {
  const out: ParsedPolicy = { tools: {} };
  const parsed = parse(raw) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") {
    return out;
  }

  const defaults = parsed.defaults;
  if (defaults && typeof defaults === "object") {
    const unknown = (defaults as Record<string, unknown>).unknown_tool;
    if (unknown === "allow" || unknown === "block" || unknown === "require_approval") {
      out.unknownTool = unknown;
    }
  }

  const tools = parsed.tools;
  if (tools && typeof tools === "object") {
    for (const [toolName, value] of Object.entries(tools as Record<string, unknown>)) {
      if (typeof value === "string") {
        if (value === "allow" || value === "block" || value === "require_approval") {
          out.tools[toolName] = { action: value };
        }
        continue;
      }
      if (!value || typeof value !== "object") {
        continue;
      }
      const status = (value as Record<string, unknown>).status;
      if (status === "allow" || status === "block" || status === "require_approval") {
        const rateLimit = (value as Record<string, unknown>).rate_limit;
        out.tools[toolName] =
          typeof rateLimit === "number"
            ? { action: status, rateLimitPerMinute: rateLimit }
            : { action: status };
      }
    }
  }

  // Backward compatibility: allow flat `tool_name: allow` mappings.
  for (const [name, value] of Object.entries(parsed)) {
    if (name === "defaults" || name === "tools") {
      continue;
    }
    if (name === "unknown_tool" && (value === "allow" || value === "block" || value === "require_approval")) {
      out.unknownTool = value;
      continue;
    }
    if (value === "allow" || value === "block" || value === "require_approval") {
      out.tools[name] = { action: value };
    }
  }
  return out;
}
