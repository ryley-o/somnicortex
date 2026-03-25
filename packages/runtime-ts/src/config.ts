import { randomUUID } from "node:crypto";
import path from "node:path";

import { protocolVersion } from "@somnicortex/ipc";
import type { AgentConfig } from "./types.js";

export function defaultConfig(agentRoot: string): AgentConfig {
  return {
    agentId: randomUUID(),
    protocolVersion,
    kernelSocketPath: path.join(agentRoot, "memory", "kernel", "kernel.sock"),
    kernelCommand: [
      "uv",
      "run",
      "--project",
      "packages/kernel-py",
      "python",
      "-m",
      "somnicortex_kernel.rpc",
      "--agent-dir",
      agentRoot
    ],
    approvalPollMs: 5000,
    approvalTimeoutMs: 24 * 60 * 60 * 1000,
    sleepState: "WAKE",
    contextBudget: 8_000,
    unknownToolPolicy: "block"
  };
}
