import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  OperationRequestSchema,
  OperationResponseSchema,
  TaskSpecSchema
} from "../dist/index.js";

test("task schema parses valid task", () => {
  const parsed = TaskSpecSchema.parse({
    id: "task-1",
    title: "Plan",
    body: "Do work",
    urgency: "normal"
  });
  assert.equal(parsed.id, "task-1");
});

test("operation request schema rejects unknown operation", () => {
  assert.throws(() =>
    OperationRequestSchema.parse({
      operation: "not_real",
      payload: {}
    })
  );
});

test("operation response supports ok and error forms", () => {
  const ok = OperationResponseSchema.parse({
    operation: "rerank",
    ok: true,
    result: { ranked: [] }
  });
  assert.equal(ok.ok, true);
  const err = OperationResponseSchema.parse({
    operation: "rerank",
    ok: false,
    result: {},
    error: { code: "E_LOW_CONFIDENCE", message: "Rejected" }
  });
  assert.equal(err.ok, false);
});

test("fixtures include all operation families", async () => {
  const root = path.resolve(import.meta.dirname, "..");
  const fixture = JSON.parse(
    await readFile(path.join(root, "fixtures", "kernel-operations.json"), "utf8")
  );
  assert.ok(Array.isArray(fixture.happyPath));
  assert.ok(Array.isArray(fixture.edgeCases));
  assert.ok(fixture.happyPath.length > 0);
  assert.ok(fixture.edgeCases.length > 0);
});
