import fs from "node:fs/promises";
import path from "node:path";
import type { SleepStateType } from "@somnicortex/ipc";
import type { AgentPaths } from "./types.js";
import { exists, readJson, writeJsonAtomic } from "./fs.js";

type SleepMode = "micro" | "full";

export class SleepManager {
  private state: SleepStateType = "WAKE";

  constructor(private readonly paths: AgentPaths) {}

  getState(): SleepStateType {
    return this.state;
  }

  async setState(next: SleepStateType): Promise<void> {
    this.state = next;
    await writeJsonAtomic(path.join(this.paths.sleep, "state.json"), { state: next });
  }

  async enqueueJob(type: string, priority: number, payload: Record<string, unknown>): Promise<void> {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await writeJsonAtomic(path.join(this.paths.sleep, "queue", `${id}.json`), {
      id,
      type,
      priority,
      payload,
      createdAt: new Date().toISOString()
    });
  }

  async queueJobs(): Promise<Record<string, unknown>[]> {
    const dir = path.join(this.paths.sleep, "queue");
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    const jobs: Record<string, unknown>[] = [];
    for (const file of files) {
      jobs.push(await readJson(path.join(dir, file), {} as Record<string, unknown>));
    }
    return jobs;
  }

  async trigger(mode: SleepMode, budgetSeconds: number): Promise<void> {
    if (mode === "micro") {
      await this.setState("MICRO_SLEEP");
      await this.runMicroSleep(budgetSeconds);
      await this.setState("WAKE");
      return;
    }
    await this.setState("FULL_SLEEP");
    await this.runFullSleep(budgetSeconds);
    await this.setState("WAKE");
  }

  private async runMicroSleep(_budgetSeconds: number): Promise<void> {
    await this.enqueueJob("serialize_working_memory", 10, {});
    await this.enqueueJob("flush_episodic", 9, {});
    await this.enqueueJob("light_activation_update", 8, {});
    await this.processQueue();
    // Working memory is volatile across sleep transitions.
    await fs.rm(this.paths.memory + "/working", { recursive: true, force: true });
    await fs.mkdir(this.paths.memory + "/working", { recursive: true });
  }

  private async runFullSleep(_budgetSeconds: number): Promise<void> {
    for (let stage = 1; stage <= 14; stage += 1) {
      await writeJsonAtomic(path.join(this.paths.sleep, "progress.json"), {
        fullSleepStage: stage,
        interrupted: false,
        updatedAt: new Date().toISOString()
      });
      await this.enqueueJob(`full_sleep_stage_${stage}`, 100 - stage, {});
    }
    await writeJsonAtomic(path.join(this.paths.sleep, "progress.json"), {
      fullSleepStage: 14,
      interrupted: false,
      completedAt: new Date().toISOString()
    });
  }

  private async processQueue(): Promise<void> {
    const queueDir = path.join(this.paths.sleep, "queue");
    const files = (await fs.readdir(queueDir)).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      const fullPath = path.join(queueDir, file);
      const job = await readJson(fullPath, {
        type: "unknown",
        payload: {}
      } as { type: string; payload: Record<string, unknown> });
      await this.executeJob(job.type, job.payload);
      await fs.rm(fullPath, { force: true });
    }
  }

  private async executeJob(type: string, payload: Record<string, unknown>): Promise<void> {
    if (type === "serialize_working_memory") {
      const scratchPath = path.join(this.paths.memory, "working", "scratch.json");
      if (await exists(scratchPath)) {
        const scratch = await readJson(scratchPath, {});
        await writeJsonAtomic(path.join(this.paths.sleep, "working_snapshot.json"), {
          serializedAt: new Date().toISOString(),
          scratch
        });
      }
      return;
    }

    if (type === "light_activation_update" || type === "post_task_activation_update") {
      const activationPath = path.join(this.paths.memory, "semantic", "activation_updates.json");
      const existing = await readJson(activationPath, { updated: 0, history: [] as string[] });
      await writeJsonAtomic(activationPath, {
        updated: Number(existing.updated ?? 0) + 1,
        history: [...(existing.history ?? []), type],
        lastPayload: payload,
        updatedAt: new Date().toISOString()
      });
    }
  }
}
