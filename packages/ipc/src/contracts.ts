import { z } from "zod";

export const protocolVersion = "1.0.0";

export const KernelOperation = z.enum([
  "classify_store",
  "score_salience",
  "detect_conflict",
  "check_neighborhood_consistency",
  "deduplicate",
  "extract_atomic_facts",
  "link_intention_to_memories",
  "generate_retrieval_query",
  "rerank",
  "reject_low_confidence",
  "consolidate_cluster",
  "update_activation_weights",
  "update_citation_rates",
  "generate_simulation_seeds",
  "score_promotion",
  "resolve_conflict"
]);

export type KernelOperationName = z.infer<typeof KernelOperation>;

export const OperationRequestSchema = z.object({
  operation: KernelOperation,
  payload: z.record(z.string(), z.unknown()),
  fixture: z.string().optional()
});

export type OperationRequest = z.infer<typeof OperationRequestSchema>;

export const OperationResponseSchema = z.object({
  operation: KernelOperation,
  ok: z.boolean(),
  result: z.record(z.string(), z.unknown()).default({}),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional()
    })
    .nullish(),
  protocolVersion: z.string().default(protocolVersion)
});

export type OperationResponse = z.infer<typeof OperationResponseSchema>;

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional()
});

export const JsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional()
});

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.nullish()
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

export const SleepState = z.enum([
  "WAKE",
  "MICRO_SLEEP",
  "FULL_SLEEP",
  "SUPERVISED_PAUSE"
]);
export type SleepStateType = z.infer<typeof SleepState>;

export const TaskUrgency = z.enum(["low", "normal", "high", "critical"]);
export type TaskUrgencyType = z.infer<typeof TaskUrgency>;

export const TaskSpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  urgency: TaskUrgency.default("normal"),
  metadata: z.record(z.string(), z.unknown()).default({})
});
export type TaskSpec = z.infer<typeof TaskSpecSchema>;

export const RecallQuerySchema = z.object({
  query: z.string(),
  topK: z.number().int().min(1).max(100).default(20),
  includePendingReview: z.boolean().default(false)
});
export type RecallQuery = z.infer<typeof RecallQuerySchema>;

export const ApprovalScopeSchema = z.enum([
  "identity.constitution",
  "identity.personality",
  "tool.high_risk",
  "tool.identity",
  "sleep.override"
]);
export type ApprovalScope = z.infer<typeof ApprovalScopeSchema>;

export const ApprovalRequestSchema = z.object({
  requestId: z.string(),
  scope: ApprovalScopeSchema,
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string()
});

export const ApprovalResultSchema = z.object({
  requestId: z.string(),
  decision: z.enum(["approved", "rejected", "timeout"]),
  reviewer: z.string().nullable(),
  decidedAt: z.string(),
  reason: z.string().optional()
});
export type ApprovalResult = z.infer<typeof ApprovalResultSchema>;

export const CapabilityManifestSchema = z.object({
  protocolVersion: z.string(),
  kernelVersion: z.string(),
  kernelFineTuned: z.boolean(),
  supportedOperations: z.array(KernelOperation),
  sleepState: SleepState,
  memoryCounts: z.object({
    episodic: z.number().int().nonnegative(),
    semanticNodes: z.number().int().nonnegative(),
    semanticEdges: z.number().int().nonnegative(),
    proceduralSkills: z.number().int().nonnegative(),
    intentions: z.number().int().nonnegative()
  })
});
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;

export const SleepJobSchema = z.object({
  id: z.string(),
  type: z.string(),
  priority: z.number().int().min(0).max(100),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string()
});

export const AuditDecisionEventSchema = z.object({
  eventType: z.enum([
    "tool_blocked",
    "approval_required",
    "consistency_blocked",
    "coverage_warning",
    "governance_violation"
  ]),
  timestamp: z.string(),
  details: z.record(z.string(), z.unknown())
});

export const IpcExportsSchema = z.object({
  protocolVersion: z.literal(protocolVersion)
});

export type IpcExports = z.infer<typeof IpcExportsSchema>;
