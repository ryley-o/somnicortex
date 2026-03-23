import test from "node:test";
import assert from "node:assert/strict";
import { extractUsedContextBlock, scoreStep } from "../src/instrumentation.js";

test("extracts used context refs", () => {
  const refs = extractUsedContextBlock(`
<used_context>
episodic:ep1
semantic:s2
</used_context>`);
  assert.equal(refs.length, 2);
});

test("scores step coverage", () => {
  assert.equal(scoreStep(["a"], 2), 0.5);
});
