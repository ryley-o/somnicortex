import path from "node:path";
import Database from "better-sqlite3";
import type { TaskSpec } from "@somnicortex/ipc";
import type { AgentConfig, AgentPaths } from "./types.js";
import type { KernelClient } from "./kernelClient.js";
import { assembleContextPacket, prefilterCandidates, rerankWithKernel } from "./retrieval.js";
import { appendJsonl, writeJsonAtomic } from "./fs.js";
import { checkToolPolicy } from "./toolPolicy.js";

export async function runFourBeatCycle(
  task: TaskSpec,
  config: AgentConfig,
  paths: AgentPaths,
  kernel: KernelClient
): Promise<Record<string, unknown>> {
  // Beat 1: focus
  const taskFocus = `${task.title}\n${task.body}`;

  // Beat 2: cue
  const cue = await kernel.operation({
    operation: "generate_retrieval_query",
    payload: { task: taskFocus }
  });

  // Beat 3: recall
  const episodicDb = new Database(path.join(paths.memory, "episodic", "ledger.db"), {
    readonly: true
  });
  const candidates = prefilterCandidates(
    episodicDb,
    String((cue.result.query as string | undefined) ?? task.title),
    20
  );
  episodicDb.close();
  const ranked = await rerankWithKernel(
    kernel,
    String((cue.result.query as string | undefined) ?? task.title),
    candidates
  );

  // Beat 4: act + tool policy gate
  await checkToolPolicy(paths, "default_executor", config.unknownToolPolicy);
  const rankedResult = (ranked.result as Record<string, unknown>) ?? {};
  const rankedItems = (rankedResult.ranked as unknown[] | undefined) ?? [];
  const packet = assembleContextPacket(
    config.contextBudget,
    taskFocus,
    [],
    rankedItems,
    [],
    [],
    []
  );
  await appendJsonl(path.join(paths.audit, "reports", "cycle.log"), {
    taskId: task.id,
    timestamp: new Date().toISOString(),
    packet
  });
  await writeJsonAtomic(path.join(paths.memory, "working", "scratch.json"), {
    taskId: task.id,
    taskFocus,
    packet,
    updatedAt: new Date().toISOString()
  });
  return packet;
}
