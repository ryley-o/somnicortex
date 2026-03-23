import type {
  ApprovalResult,
  CapabilityManifest,
  RecallQuery,
  TaskSpec
} from "@somnicortex/ipc";
import type { SleepStateType } from "@somnicortex/ipc";

export interface AgentPaths {
  root: string;
  memory: string;
  audit: string;
  sleep: string;
}

export interface AgentConfig {
  agentId: string;
  protocolVersion: string;
  kernelSocketPath: string;
  kernelCommand: string[];
  kernelWorkingDirectory?: string;
  kernelEnv?: Record<string, string>;
  approvalPollMs: number;
  approvalTimeoutMs: number;
  sleepState: SleepStateType;
  contextBudget: number;
  unknownToolPolicy: "allow" | "block";
}

export interface AgentApi {
  receiveTask(task: TaskSpec): Promise<void>;
  report(payload: Record<string, unknown>): Promise<void>;
  requestApproval(
    scope: string,
    payload: Record<string, unknown>
  ): Promise<ApprovalResult>;
  exposeCapabilities(): Promise<CapabilityManifest>;
  getSleepState(): SleepStateType;
  triggerSleep(mode: "micro" | "full", budgetSeconds: number): Promise<void>;
  getSleepQueue(): Promise<Record<string, unknown>[]>;
  recall(query: RecallQuery): Promise<Record<string, unknown>>;
  getIdentitySnapshot(): Promise<Record<string, unknown>>;
}
