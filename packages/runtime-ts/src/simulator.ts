import fs from "node:fs/promises";
import path from "node:path";
import type { AgentPaths } from "./types.js";
import { GovernanceViolation } from "./errors.js";

export async function generateDream(
  paths: AgentPaths,
  seed: string,
  boundedMaxTokens = 512
): Promise<string> {
  const id = `dream_${Date.now().toString(36)}`;
  const dreamPath = path.join(paths.sleep, "dreams", `${id}.json`);
  await fs.writeFile(
    dreamPath,
    JSON.stringify(
      {
        id,
        seed,
        text: `Dream generated from seed ${seed}`,
        boundedMaxTokens,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      null,
      2
    ),
    "utf8"
  );
  return id;
}

export async function promoteDream(
  paths: AgentPaths,
  dreamId: string,
  destination: "semantic" | "procedural" | "values"
): Promise<void> {
  if (destination === "values") {
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
