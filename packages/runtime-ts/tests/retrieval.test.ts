import test from "node:test";
import assert from "node:assert/strict";

import { activationScore, assembleContextPacket } from "../src/retrieval.js";

test("activation score is weighted sum", () => {
  const score = activationScore(1, 1, 1, 1);
  assert.equal(score, 1);
});

test("context packet evicts episodic and semantic when over budget", () => {
  const packet = assembleContextPacket(
    120,
    "task",
    [],
    [{ id: "ep1", text: "long long long long long" }],
    [{ id: "s1", text: "long long long long long" }],
    [],
    []
  );
  assert.deepEqual(packet.episodic_recall, []);
  assert.deepEqual(packet.semantic, []);
});
