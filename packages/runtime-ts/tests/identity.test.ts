import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { appendIdentityEntry } from "../src/identity.js";

test("agent cannot write constitution scope", async () => {
  const root = path.join(process.cwd(), ".tmp-identity-test");
  await fs.mkdir(path.join(root, "memory", "values"), { recursive: true });
  await fs.writeFile(
    path.join(root, "memory", "values", "identity_log.jsonl"),
    JSON.stringify({ initial: true }) + "\n",
    "utf8"
  );
  await assert.rejects(() =>
    appendIdentityEntry(
      {
        root,
        memory: path.join(root, "memory"),
        audit: path.join(root, "audit"),
        sleep: path.join(root, "sleep")
      },
      "constitution",
      {},
      "agent",
      false
    )
  );
});
