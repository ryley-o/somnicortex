import fs from "node:fs/promises";
import path from "node:path";
import type { AgentConfig, AgentPaths } from "./types.js";
import { ensureDir, exists, writeJsonAtomic } from "./fs.js";
import {
  migrateEpisodic,
  migrateProcedural,
  migrateProspective,
  migrateSemantic,
  openSqliteWithPragmas
} from "./db.js";

export function deriveAgentPaths(root: string): AgentPaths {
  return {
    root,
    memory: path.join(root, "memory"),
    audit: path.join(root, "audit"),
    sleep: path.join(root, "sleep")
  };
}

export async function initializeSubstrate(
  paths: AgentPaths,
  config: AgentConfig
): Promise<void> {
  const dirs = [
    paths.root,
    path.join(paths.memory, "episodic"),
    path.join(paths.memory, "semantic"),
    path.join(paths.memory, "procedural"),
    path.join(paths.memory, "working"),
    path.join(paths.memory, "values"),
    path.join(paths.memory, "kernel", "model_weights"),
    path.join(paths.memory, "kernel", "training_data"),
    path.join(paths.audit, "pending_approvals"),
    path.join(paths.audit, "reports"),
    path.join(paths.sleep, "queue"),
    path.join(paths.sleep, "dreams")
  ];
  await Promise.all(dirs.map((d) => ensureDir(d)));

  const episodicDb = await openSqliteWithPragmas(
    path.join(paths.memory, "episodic", "ledger.db")
  );
  migrateEpisodic(episodicDb);
  episodicDb.close();

  const semanticDb = await openSqliteWithPragmas(
    path.join(paths.memory, "semantic", "graph.db")
  );
  migrateSemantic(semanticDb);
  semanticDb.close();

  const skillsDb = await openSqliteWithPragmas(
    path.join(paths.memory, "procedural", "skills.db")
  );
  migrateProcedural(skillsDb);
  skillsDb.close();

  const policiesDb = await openSqliteWithPragmas(
    path.join(paths.memory, "procedural", "policies.db")
  );
  migrateProcedural(policiesDb);
  policiesDb.close();

  const prospectiveDb = await openSqliteWithPragmas(
    path.join(paths.memory, "prospective.db")
  );
  migrateProspective(prospectiveDb);
  prospectiveDb.close();

  const configPath = path.join(paths.root, "agent.yaml");
  if (!(await exists(configPath))) {
    await fs.writeFile(
      configPath,
      [
        `agent_id: ${config.agentId}`,
        `protocol_version: ${config.protocolVersion}`,
        `sleep_state: ${config.sleepState}`,
        `kernel_socket_path: ${config.kernelSocketPath}`,
        `approval_poll_ms: ${config.approvalPollMs}`,
        `approval_timeout_ms: ${config.approvalTimeoutMs}`,
        `context_budget: ${config.contextBudget}`,
        ""
      ].join("\n"),
      "utf8"
    );
  }

  await ensureIdentityBootstrap(paths);
  await writeJsonAtomic(path.join(paths.sleep, "progress.json"), {
    fullSleepStage: 0,
    interrupted: false
  });
}

async function ensureIdentityBootstrap(paths: AgentPaths): Promise<void> {
  const identityLogPath = path.join(paths.memory, "values", "identity_log.jsonl");
  if (!(await exists(identityLogPath))) {
    await fs.writeFile(
      identityLogPath,
      `${JSON.stringify({
        change_type: "initial",
        author: "human_operator",
        timestamp: new Date().toISOString(),
        payload: {}
      })}\n`,
      "utf8"
    );
  }
}
