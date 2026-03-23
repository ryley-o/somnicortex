import Database from "better-sqlite3";
import type { KernelClient } from "./kernelClient.js";

export interface CandidateMemory {
  id: string;
  content: string;
  activation: number;
}

export function activationScore(
  recencyFactor: number,
  salienceFactor: number,
  citationRate: number,
  authorityTier: number
): number {
  return recencyFactor * 0.4 + salienceFactor * 0.35 + citationRate * 0.15 + authorityTier * 0.1;
}

export function prefilterCandidates(
  db: Database.Database,
  query: string,
  topK: number
): CandidateMemory[] {
  const stmt = db.prepare(
    `
    SELECT id, content, salience
    FROM episodes
    WHERE content LIKE ?
    ORDER BY salience DESC
    LIMIT ?
  `
  );
  const rows = stmt.all(`%${query}%`, topK) as Array<{
    id: string;
    content: string;
    salience: number;
  }>;
  return rows.map((row) => ({ id: row.id, content: row.content, activation: row.salience }));
}

export async function rerankWithKernel(
  kernel: KernelClient,
  query: string,
  candidates: CandidateMemory[]
): Promise<Record<string, unknown>> {
  return kernel.operation({
    operation: "rerank",
    payload: { query, candidates }
  });
}

export function assembleContextPacket(
  budget: number,
  taskFocus: string,
  prospective: unknown[],
  episodicRecall: unknown[],
  semantic: unknown[],
  policy: unknown[],
  safetyValues: unknown[]
): Record<string, unknown> {
  const packet = {
    task_focus: taskFocus,
    prospective,
    episodic_recall: episodicRecall,
    semantic,
    policy,
    safety_values: safetyValues
  };
  const encoded = JSON.stringify(packet);
  if (encoded.length <= budget) {
    return packet;
  }
  const reduced = {
    ...packet,
    episodic_recall: [],
    semantic: []
  };
  if (JSON.stringify(reduced).length > budget) {
    throw new Error("Context budget exceeded after evicting episodic and semantic slots");
  }
  return reduced;
}
