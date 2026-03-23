import fs from "node:fs/promises";
import path from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  OperationRequestSchema,
  OperationResponseSchema,
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  TaskSpecSchema,
  RecallQuerySchema,
  ApprovalResultSchema,
  CapabilityManifestSchema
} from "../dist/index.js";

const packageRoot = path.resolve(import.meta.dirname, "..");
const schemaDir = path.join(packageRoot, "schemas");
await fs.mkdir(schemaDir, { recursive: true });

const entries = [
  ["OperationRequest", OperationRequestSchema],
  ["OperationResponse", OperationResponseSchema],
  ["JsonRpcRequest", JsonRpcRequestSchema],
  ["JsonRpcResponse", JsonRpcResponseSchema],
  ["TaskSpec", TaskSpecSchema],
  ["RecallQuery", RecallQuerySchema],
  ["ApprovalResult", ApprovalResultSchema],
  ["CapabilityManifest", CapabilityManifestSchema]
];

for (const [name, schemaDef] of entries) {
  const schema = zodToJsonSchema(schemaDef, { name });
  const outPath = path.join(schemaDir, `${name}.schema.json`);
  await fs.writeFile(outPath, JSON.stringify(schema, null, 2));
}

console.log(`Wrote ${entries.length} schemas to ${schemaDir}`);
