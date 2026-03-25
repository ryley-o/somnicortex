import path from "node:path";
import fs from "node:fs/promises";
import type { AgentPaths } from "./types.js";
import {
  appendJsonl,
  readJson,
  exists,
  sha256,
  writeJsonAtomic
} from "./fs.js";
import { GovernanceViolation } from "./errors.js";

type IdentityScope =
  | "initial"
  | "constitution"
  | "personality"
  | "identity_metadata"
  | "moral_weight";
type IdentityActor = "agent" | "human_operator";

const HUMAN_ONLY = new Set<IdentityScope>(["constitution", "moral_weight"]);
const GENESIS_HASH = "GENESIS";

interface IdentityLogEntry {
  change_type: IdentityScope;
  author: IdentityActor;
  timestamp: string;
  approved?: boolean;
  payload: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}

export async function appendIdentityEntry(
  paths: AgentPaths,
  scope: IdentityScope,
  payload: Record<string, unknown>,
  actor: IdentityActor,
  approved: boolean
): Promise<void> {
  if (actor === "agent" && HUMAN_ONLY.has(scope)) {
    throw new GovernanceViolation(`${scope} is human-only`);
  }
  if (actor === "agent" && scope === "personality" && !approved) {
    throw new GovernanceViolation("personality changes require approval");
  }

  const identityLogPath = path.join(paths.memory, "values", "identity_log.jsonl");
  const prevHash = await getLastKnownHash(identityLogPath);
  const timestamp = new Date().toISOString();
  const entry: IdentityLogEntry = {
    change_type: scope,
    author: actor,
    timestamp,
    approved,
    payload,
    prev_hash: prevHash,
    hash: buildEntryHash({
      change_type: scope,
      author: actor,
      timestamp,
      approved,
      payload,
      prev_hash: prevHash
    })
  };
  await appendJsonl(identityLogPath, entry);
  await writeJsonAtomic(path.join(paths.memory, "values", "snapshot_hash"), {
    sha256: entry.hash,
    updatedAt: timestamp
  });
}

export async function verifyIdentitySnapshot(paths: AgentPaths): Promise<boolean> {
  const identityLogPath = path.join(paths.memory, "values", "identity_log.jsonl");
  const snapshotPath = path.join(paths.memory, "values", "snapshot_hash");
  if (!(await exists(identityLogPath))) {
    return false;
  }
  const raw = await fs.readFile(identityLogPath, "utf8");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    return false;
  }
  const snapshot = await readJson(snapshotPath, { sha256: "" });

  // Backward compatibility for pre-hash-chain logs.
  const first = parseLine(lines[0]!);
  if (!("hash" in first) || !("prev_hash" in first)) {
    return snapshot.sha256 === sha256(lines[lines.length - 1] ?? "");
  }

  let prev = GENESIS_HASH;
  for (const line of lines) {
    const parsed = toIdentityEntry(parseLine(line));
    if (!parsed) {
      return false;
    }
    if (parsed.prev_hash !== prev) {
      return false;
    }
    const expected = buildEntryHash({
      change_type: parsed.change_type,
      author: parsed.author,
      timestamp: parsed.timestamp,
      approved: parsed.approved ?? false,
      payload: parsed.payload,
      prev_hash: parsed.prev_hash
    });
    if (parsed.hash !== expected) {
      return false;
    }
    prev = parsed.hash;
  }
  return snapshot.sha256 === prev;
}

export async function compactIdentitySnapshot(paths: AgentPaths): Promise<void> {
  const identityLogPath = path.join(paths.memory, "values", "identity_log.jsonl");
  if (!(await exists(identityLogPath))) {
    return;
  }
  const raw = await fs.readFile(identityLogPath, "utf8");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const latestByScope: Record<string, IdentityLogEntry> = {};
  for (const line of lines) {
    const parsed = toIdentityEntry(parseLine(line));
    if (!parsed) {
      continue;
    }
    latestByScope[parsed.change_type] = parsed;
  }
  const tip = await getLastKnownHash(identityLogPath);
  await writeJsonAtomic(path.join(paths.memory, "values", "snapshot_compaction.json"), {
    compactedAt: new Date().toISOString(),
    totalEntries: lines.length,
    tipHash: tip,
    scopes: latestByScope
  });
}

function parseLine(line: string): Record<string, unknown> {
  return JSON.parse(line) as Record<string, unknown>;
}

function toIdentityEntry(raw: Record<string, unknown>): IdentityLogEntry | null {
  if (
    typeof raw.change_type !== "string" ||
    typeof raw.author !== "string" ||
    typeof raw.timestamp !== "string" ||
    typeof raw.prev_hash !== "string" ||
    typeof raw.hash !== "string"
  ) {
    return null;
  }
  const payload =
    raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : {};
  const base: IdentityLogEntry = {
    change_type: raw.change_type as IdentityScope,
    author: raw.author as IdentityActor,
    timestamp: raw.timestamp,
    payload,
    prev_hash: raw.prev_hash,
    hash: raw.hash
  };
  if (typeof raw.approved === "boolean") {
    base.approved = raw.approved;
  }
  return base;
}

async function getLastKnownHash(identityLogPath: string): Promise<string> {
  if (!(await exists(identityLogPath))) {
    return GENESIS_HASH;
  }
  const raw = await fs.readFile(identityLogPath, "utf8");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lastLine = lines[lines.length - 1];
  if (!lastLine) {
    return GENESIS_HASH;
  }
  const parsed = parseLine(lastLine);
  if (typeof parsed.hash === "string" && parsed.hash.length > 0) {
    return parsed.hash;
  }
  return sha256(lastLine);
}

function buildEntryHash(value: {
  change_type: IdentityScope;
  author: IdentityActor;
  timestamp: string;
  approved: boolean;
  payload: Record<string, unknown>;
  prev_hash: string;
}): string {
  const canonical = JSON.stringify({
    change_type: value.change_type,
    author: value.author,
    timestamp: value.timestamp,
    approved: value.approved,
    payload: value.payload,
    prev_hash: value.prev_hash
  });
  return sha256(canonical);
}
