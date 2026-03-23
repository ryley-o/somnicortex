import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import type {
  ApprovalResult,
  CapabilityManifest,
  RecallQuery,
  TaskSpec
} from "@somnicortex/ipc";
import { protocolVersion } from "@somnicortex/ipc";
import { defaultConfig } from "./config.js";
import type { AgentApi, AgentConfig, AgentPaths } from "./types.js";
import { deriveAgentPaths, initializeSubstrate } from "./substrate.js";
import { KernelClient } from "./kernelClient.js";
import { KernelSupervisor } from "./kernelSupervisor.js";
import { SleepManager } from "./sleep.js";
import { requestApproval } from "./approval.js";
import { appendIdentityEntry, verifyIdentitySnapshot } from "./identity.js";
import { runFourBeatCycle } from "./cognition.js";
import { appendJsonl, readJson } from "./fs.js";
import { generateDream, promoteDream } from "./simulator.js";

export class Agent implements AgentApi {
  private readonly config: AgentConfig;
  private readonly paths: AgentPaths;
  private readonly sleep: SleepManager;
  private readonly kernelSupervisor: KernelSupervisor;
  private readonly kernelClient: KernelClient;

  private constructor(agentRoot: string, config?: Partial<AgentConfig>) {
    this.paths = deriveAgentPaths(agentRoot);
    this.config = { ...defaultConfig(agentRoot), ...config };
    this.sleep = new SleepManager(this.paths);
    const supervisorOptions: { cwd?: string; env?: Record<string, string> } = {};
    if (this.config.kernelWorkingDirectory) {
      supervisorOptions.cwd = this.config.kernelWorkingDirectory;
    }
    if (this.config.kernelEnv) {
      supervisorOptions.env = this.config.kernelEnv;
    }
    this.kernelSupervisor = new KernelSupervisor(
      this.config.kernelCommand,
      this.config.kernelSocketPath,
      supervisorOptions
    );
    this.kernelClient = new KernelClient(this.config.kernelSocketPath);
  }

  static async create(agentRoot: string, config?: Partial<AgentConfig>): Promise<Agent> {
    const agent = new Agent(agentRoot, config);
    await initializeSubstrate(agent.paths, agent.config);
    await agent.kernelSupervisor.start();
    const snapshotOk = await verifyIdentitySnapshot(agent.paths);
    if (!snapshotOk) {
      await agent.sleep.setState("SUPERVISED_PAUSE");
      await appendJsonl(path.join(agent.paths.audit, "decisions.log"), {
        eventType: "snapshot_mismatch",
        timestamp: new Date().toISOString()
      });
    } else {
      await agent.sleep.setState("WAKE");
    }
    return agent;
  }

  async receiveTask(task: TaskSpec): Promise<void> {
    await runFourBeatCycle(task, this.config, this.paths, this.kernelClient);
    const db = new Database(path.join(this.paths.memory, "episodic", "ledger.db"));
    db.prepare(
      `
      INSERT INTO episodes (id, created_at, task_id, content, salience, citation_rate)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      `ep_${Date.now().toString(36)}`,
      new Date().toISOString(),
      task.id,
      `${task.title}\n${task.body}`,
      0.5,
      0.0
    );
    db.close();
    await this.sleep.enqueueJob("post_task_activation_update", 40, { taskId: task.id });
  }

  async receive_task(task: TaskSpec): Promise<void> {
    await this.receiveTask(task);
  }

  async report(payload: Record<string, unknown>): Promise<void> {
    await appendJsonl(path.join(this.paths.audit, "reports", "report.log"), {
      timestamp: new Date().toISOString(),
      payload
    });
  }

  async requestApproval(
    scope: string,
    payload: Record<string, unknown>
  ): Promise<ApprovalResult> {
    await this.sleep.setState("SUPERVISED_PAUSE");
    const result = await requestApproval(this.paths, this.config, scope, payload);
    await this.sleep.setState("WAKE");
    return result;
  }

  async exposeCapabilities(): Promise<CapabilityManifest> {
    const health = await this.kernelClient.health();
    const memoryCounts = await this.memoryCounts();
    return {
      protocolVersion: this.config.protocolVersion,
      kernelVersion: String(health.version ?? "unknown"),
      kernelFineTuned: Boolean(health.fineTuned ?? false),
      supportedOperations: health.supportedOperations as CapabilityManifest["supportedOperations"],
      sleepState: this.sleep.getState(),
      memoryCounts
    };
  }

  getSleepState() {
    return this.sleep.getState();
  }

  get_sleep_state() {
    return this.getSleepState();
  }

  async triggerSleep(mode: "micro" | "full", budgetSeconds: number): Promise<void> {
    await this.sleep.trigger(mode, budgetSeconds);
  }

  async trigger_sleep(mode: "micro" | "full", budgetSeconds: number): Promise<void> {
    await this.triggerSleep(mode, budgetSeconds);
  }

  async getSleepQueue(): Promise<Record<string, unknown>[]> {
    return this.sleep.queueJobs();
  }

  async recall(query: RecallQuery): Promise<Record<string, unknown>> {
    const db = new Database(path.join(this.paths.memory, "episodic", "ledger.db"), {
      readonly: true
    });
    const rows = db
      .prepare("SELECT id, content, salience FROM episodes WHERE content LIKE ? ORDER BY salience DESC LIMIT ?")
      .all(`%${query.query}%`, query.topK);
    db.close();
    return { items: rows };
  }

  async getIdentitySnapshot(): Promise<Record<string, unknown>> {
    const snapshotPath = path.join(this.paths.memory, "values", "snapshot_hash");
    return readJson(snapshotPath, { sha256: "" });
  }

  async applyIdentityChange(
    scope: "constitution" | "personality" | "identity_metadata" | "moral_weight",
    payload: Record<string, unknown>
  ): Promise<void> {
    let approved = false;
    if (scope === "personality") {
      const result = await this.requestApproval("identity.personality", payload);
      approved = result.decision === "approved";
    }
    await appendIdentityEntry(this.paths, scope, payload, "agent", approved);
  }

  async runSimulator(seed: string): Promise<string> {
    return generateDream(this.paths, seed);
  }

  async promoteSimulation(id: string, destination: "semantic" | "procedural" | "values"): Promise<void> {
    await promoteDream(this.paths, id, destination);
  }

  async shutdown(): Promise<void> {
    await this.kernelSupervisor.stop();
  }

  private async memoryCounts() {
    const episodicDb = new Database(path.join(this.paths.memory, "episodic", "ledger.db"), {
      readonly: true
    });
    const semanticDb = new Database(path.join(this.paths.memory, "semantic", "graph.db"), {
      readonly: true
    });
    const skillsDb = new Database(path.join(this.paths.memory, "procedural", "skills.db"), {
      readonly: true
    });
    const prospectiveDb = new Database(path.join(this.paths.memory, "prospective.db"), {
      readonly: true
    });
    const episodic = Number(
      (episodicDb.prepare("SELECT COUNT(*) AS c FROM episodes").get() as { c: number }).c
    );
    const semanticNodes = Number(
      (semanticDb.prepare("SELECT COUNT(*) AS c FROM nodes").get() as { c: number }).c
    );
    const semanticEdges = Number(
      (semanticDb.prepare("SELECT COUNT(*) AS c FROM edges").get() as { c: number }).c
    );
    const proceduralSkills = Number(
      (skillsDb.prepare("SELECT COUNT(*) AS c FROM skills").get() as { c: number }).c
    );
    const intentions = Number(
      (prospectiveDb.prepare("SELECT COUNT(*) AS c FROM intentions").get() as { c: number }).c
    );
    episodicDb.close();
    semanticDb.close();
    skillsDb.close();
    prospectiveDb.close();
    return { episodic, semanticNodes, semanticEdges, proceduralSkills, intentions };
  }
}

export async function createAgent(
  root: string,
  config?: Partial<AgentConfig>
): Promise<Agent> {
  await fs.mkdir(root, { recursive: true });
  return Agent.create(root, config);
}

export const runtimeProtocolVersion = protocolVersion;
