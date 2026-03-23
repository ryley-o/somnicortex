import path from "node:path";
import type { AgentPaths } from "./types.js";
import {
  appendJsonl,
  readJson,
  readJsonlLastLine,
  sha256,
  writeJsonAtomic
} from "./fs.js";
import { GovernanceViolation } from "./errors.js";

type IdentityScope = "constitution" | "personality" | "identity_metadata" | "moral_weight";

const HUMAN_ONLY = new Set<IdentityScope>(["constitution", "moral_weight"]);

export async function appendIdentityEntry(
  paths: AgentPaths,
  scope: IdentityScope,
  payload: Record<string, unknown>,
  actor: "agent" | "human_operator",
  approved: boolean
): Promise<void> {
  if (actor === "agent" && HUMAN_ONLY.has(scope)) {
    throw new GovernanceViolation(`${scope} is human-only`);
  }
  if (actor === "agent" && scope === "personality" && !approved) {
    throw new GovernanceViolation("personality changes require approval");
  }

  const identityLogPath = path.join(paths.memory, "values", "identity_log.jsonl");
  await appendJsonl(identityLogPath, {
    change_type: scope,
    author: actor,
    timestamp: new Date().toISOString(),
    approved,
    payload
  });

  const tail = await readJsonlLastLine(identityLogPath);
  await writeJsonAtomic(path.join(paths.memory, "values", "snapshot_hash"), {
    sha256: sha256(tail)
  });
}

export async function verifyIdentitySnapshot(paths: AgentPaths): Promise<boolean> {
  const identityLogPath = path.join(paths.memory, "values", "identity_log.jsonl");
  const snapshotPath = path.join(paths.memory, "values", "snapshot_hash");
  const tail = await readJsonlLastLine(identityLogPath);
  const expected = sha256(tail);
  const snapshot = await readJson(snapshotPath, { sha256: "" });
  return snapshot.sha256 === expected;
}
