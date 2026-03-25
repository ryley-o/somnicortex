import fs from "node:fs/promises";
import path from "node:path";
import type { AgentPaths } from "./types.js";
import { GovernanceViolation } from "./errors.js";

export async function generateDream(
  paths: AgentPaths,
  seed: string,
  boundedMaxTokens = 512
): Promise<string> {
  return runDefaultModeSimulator(paths, { seed, boundedMaxTokens });
}

export async function promoteDream(
  paths: AgentPaths,
  dreamId: string,
  destination: "semantic" | "procedural" | "values" | "identity"
): Promise<void> {
  if (destination === "values" || destination === "identity") {
    throw new GovernanceViolation("Simulator cannot promote dreams into values/identity");
  }
  await fs.appendFile(
    path.join(paths.audit, "decisions.log"),
    `${JSON.stringify({
      eventType: "dream_promoted",
      dreamId,
      destination,
      timestamp: new Date().toISOString()
    })}\n`,
    "utf8"
  );
}

export async function runDefaultModeSimulator(
  paths: AgentPaths,
  options?: { seed?: string; boundedMaxTokens?: number }
): Promise<string> {
  const seed = options?.seed ?? "full_sleep";
  const boundedMaxTokens = options?.boundedMaxTokens ?? 512;
  const gapAnalysis = {
    missingEvidence: ["citation trail", "recent contradictory observations"],
    weakPlans: ["unvalidated retrieval heuristics"],
    confidence: 0.63
  };
  const planSketch = {
    candidateSteps: [
      "collect additional examples from recent episodic ledger",
      "re-evaluate retrieval weighting against contradictory evidence",
      "propose procedural refinement for post-task activation updates"
    ],
    priority: "medium"
  };
  const counterfactualReplay = {
    scenario: "What if low-confidence evidence were weighted higher?",
    observedRisk: "hallucinated semantic links",
    mitigation: "preserve confidence threshold and request human review for identity-adjacent changes"
  };

  const id = `dream_${Date.now().toString(36)}`;
  await fs.mkdir(path.join(paths.sleep, "dreams"), { recursive: true });
  const dreamPath = path.join(paths.sleep, "dreams", `${id}.json`);
  const createdAt = new Date().toISOString();
  const dream = {
    id,
    seed,
    mode: "default_mode_simulator",
    boundedMaxTokens,
    text: `DMS synthesis from seed ${seed}`,
    gapAnalysis,
    planSketch,
    counterfactualReplay,
    promotionProtocol: {
      blockedDestinations: ["values", "identity"],
      allowedDestinations: ["semantic", "procedural"],
      requiresGovernanceReview: true
    },
    metadata: {
      generatedBy: "runtime-ts/simulator",
      governanceLocked: true
    },
    createdAt,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  await fs.writeFile(dreamPath, `${JSON.stringify(dream, null, 2)}\n`, "utf8");
  return id;
}
