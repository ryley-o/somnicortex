import fs from "node:fs/promises";
import path from "node:path";
import type { ApprovalResult } from "@somnicortex/ipc";
import type { AgentConfig, AgentPaths } from "./types.js";
import { appendJsonl, readJson, writeJsonAtomic } from "./fs.js";

export async function requestApproval(
  paths: AgentPaths,
  config: AgentConfig,
  scope: string,
  payload: Record<string, unknown>
): Promise<ApprovalResult> {
  const requestId = `apr_${Date.now().toString(36)}`;
  const requestPath = path.join(paths.audit, "pending_approvals", `${requestId}.json`);
  const now = new Date().toISOString();
  await writeJsonAtomic(requestPath, {
    requestId,
    scope,
    payload,
    status: "pending",
    createdAt: now
  });

  const deadline = Date.now() + config.approvalTimeoutMs;
  while (Date.now() < deadline) {
    const req = await readJson(requestPath, {
      requestId,
      status: "pending"
    } as Record<string, unknown>);
    if (req.status === "approved" || req.status === "rejected") {
      const result: ApprovalResult = {
        requestId,
        decision: req.status as "approved" | "rejected",
        reviewer: (req.reviewer as string | undefined) ?? null,
        decidedAt: (req.decidedAt as string | undefined) ?? new Date().toISOString(),
        reason: req.reason as string | undefined
      };
      await appendJsonl(path.join(paths.audit, "approvals.log"), result);
      return result;
    }
    await wait(config.approvalPollMs);
  }

  const timeoutResult: ApprovalResult = {
    requestId,
    decision: "rejected",
    reviewer: null,
    decidedAt: new Date().toISOString(),
    reason: "approval timeout reached (auto-rejected)"
  };
  await writeJsonAtomic(requestPath, {
    requestId,
    scope,
    payload,
    status: "rejected",
    reviewer: null,
    decidedAt: timeoutResult.decidedAt,
    reason: timeoutResult.reason,
    autoRejected: true
  });
  await appendJsonl(path.join(paths.audit, "approvals.log"), timeoutResult);
  return timeoutResult;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
