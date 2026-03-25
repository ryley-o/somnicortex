import fs from "node:fs/promises";
import path from "node:path";
import type { AgentConfig, AgentPaths } from "./types.js";
import { ensureDir, exists, sha256, writeJsonAtomic } from "./fs.js";
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
    path.join(paths.root, "tools"),
    path.join(paths.root, "skills"),
    path.join(paths.root, "skills", "recipes"),
    path.join(paths.memory, "episodic"),
    path.join(paths.memory, "semantic"),
    path.join(paths.memory, "procedural"),
    path.join(paths.memory, "working"),
    path.join(paths.memory, "values"),
    path.join(paths.memory, "kernel"),
    path.join(paths.audit, "pending_approvals"),
    path.join(paths.audit, "reports"),
    path.join(paths.sleep, "queue"),
    path.join(paths.sleep, "summaries"),
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
  await ensureTextFile(
    path.join(paths.root, "tools", "mcp_servers.yaml"),
    "servers: []\n"
  );
  await ensureTextFile(
    path.join(paths.root, "tools", "tool_policies.yaml"),
    [
      "defaults:",
      "  unknown_tool: block",
      "  rate_limit_window_seconds: 60",
      "",
      "tools:",
      "  default_executor:",
      "    status: allow",
      ""
    ].join("\n")
  );
  await ensureTextFile(
    path.join(paths.root, "skills", "catalog.md"),
    "# Skills Catalog\n\n"
  );
  await ensureTextFile(
    path.join(paths.memory, "kernel", "kernel_config.yaml"),
    [
      "kernel:",
      "  socket_path: memory/kernel/kernel.sock",
      ""
    ].join("\n")
  );
  await ensureTextFile(path.join(paths.audit, "decisions.log"), "");

  await ensureIdentityBootstrap(paths);
  await writeJsonAtomic(path.join(paths.sleep, "progress.json"), {
    fullSleepStage: 0,
    interrupted: false
  });
}

async function ensureIdentityBootstrap(paths: AgentPaths): Promise<void> {
  const identityLogPath = path.join(paths.memory, "values", "identity_log.jsonl");
  const snapshotPath = path.join(paths.memory, "values", "snapshot_hash");
  if (!(await exists(identityLogPath))) {
    const timestamp = new Date().toISOString();
    const initial = {
      change_type: "initial",
      author: "human_operator",
      timestamp,
      approved: true,
      payload: {},
      prev_hash: "GENESIS"
    };
    const hash = sha256(JSON.stringify(initial));
    await fs.writeFile(
      identityLogPath,
      `${JSON.stringify({ ...initial, hash })}\n`,
      "utf8"
    );
    await writeJsonAtomic(snapshotPath, {
      sha256: hash,
      updatedAt: timestamp
    });
    return;
  }

  if (!(await exists(snapshotPath))) {
    const raw = await fs.readFile(identityLogPath, "utf8");
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const tail = lines[lines.length - 1] ?? "";
    const parsed = tail ? (JSON.parse(tail) as Record<string, unknown>) : {};
    const hash =
      typeof parsed.hash === "string" && parsed.hash.length
        ? parsed.hash
        : sha256(tail);
    await writeJsonAtomic(snapshotPath, {
      sha256: hash,
      updatedAt: new Date().toISOString()
    });
  }
}

async function ensureTextFile(filePath: string, content: string): Promise<void> {
  if (await exists(filePath)) {
    return;
  }
  await fs.writeFile(filePath, content, "utf8");
}
