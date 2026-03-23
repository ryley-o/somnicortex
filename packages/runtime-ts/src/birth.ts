import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type { AgentConfig } from "./types.js";
import { createAgent, type Agent } from "./agent.js";
import { writeJsonAtomic } from "./fs.js";

export interface BirthSpec {
  identity?: Record<string, unknown>;
  constitution?: Record<string, unknown>;
  personality?: Record<string, unknown>;
  cognitive_priors?: Record<string, unknown>;
  authority_tier?: string;
  initial_semantic_beliefs?: unknown[];
  initial_skills?: unknown[];
}

export async function createAgentFromBirthSpec(
  agentRoot: string,
  birthSpecPath: string,
  archetypeName: string,
  config?: Partial<AgentConfig>,
  options?: { archetypeDir?: string }
): Promise<Agent> {
  const archetypeDir = options?.archetypeDir ?? path.join(process.cwd(), "archetypes");
  const archetypePath = path.join(
    archetypeDir,
    `${archetypeName}.yaml`
  );
  const basePath = path.join(archetypeDir, "base.yaml");
  const [baseRaw, archetypeRaw, birthRaw] = await Promise.all([
    fs.readFile(basePath, "utf8"),
    fs.readFile(archetypePath, "utf8"),
    fs.readFile(birthSpecPath, "utf8")
  ]);
  const base = parse(baseRaw) as BirthSpec;
  const archetype = parse(archetypeRaw) as BirthSpec;
  const birth = parse(birthRaw) as BirthSpec;
  const merged = deepMerge(
    base as Record<string, unknown>,
    deepMerge(
      archetype as Record<string, unknown>,
      birth as Record<string, unknown>
    )
  );
  const agent = await createAgent(agentRoot, config);
  await writeJsonAtomic(path.join(agentRoot, "birth_spec_snapshot.json"), merged);
  return agent;
}

function deepMerge<T extends Record<string, unknown>>(left: T, right: T): T {
  const out: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const prev = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(
        prev as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
