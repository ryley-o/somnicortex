import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
import { SleepManager } from "../src/sleep.js";

test("full sleep writes 14 stages and queue jobs", async () => {
  const root = path.join(process.cwd(), ".tmp-sleep-test");
  await fs.mkdir(path.join(root, "sleep", "queue"), { recursive: true });
  const sleep = new SleepManager({
    root,
    memory: path.join(root, "memory"),
    audit: path.join(root, "audit"),
    sleep: path.join(root, "sleep")
  });
  await sleep.trigger("full", 30);
  const progressRaw = await fs.readFile(path.join(root, "sleep", "progress.json"), "utf8");
  const progress = JSON.parse(progressRaw) as { fullSleepStage: number };
  assert.equal(progress.fullSleepStage, 14);
});
