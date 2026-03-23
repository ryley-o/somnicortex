import path from "node:path";
import type { AgentPaths } from "./types.js";
import { appendJsonl } from "./fs.js";

export function extractUsedContextBlock(response: string): string[] {
  const start = response.indexOf("<used_context>");
  const end = response.indexOf("</used_context>");
  if (start < 0 || end < 0 || end <= start) {
    return [];
  }
  const body = response
    .slice(start + "<used_context>".length, end)
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return body;
}

export function scoreStep(usedRefs: string[], candidateCount: number): number {
  if (candidateCount === 0) {
    return 0;
  }
  return Math.min(1, usedRefs.length / candidateCount);
}

export async function emitCoverageWarning(
  paths: AgentPaths,
  coverage: number
): Promise<void> {
  if (coverage >= 0.7) {
    return;
  }
  await appendJsonl(path.join(paths.audit, "decisions.log"), {
    eventType: "coverage_warning",
    timestamp: new Date().toISOString(),
    coverage
  });
}
