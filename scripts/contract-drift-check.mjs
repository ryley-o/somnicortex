import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const watchedDirs = [
  "packages/ipc/schemas",
  "packages/kernel-py/somnicortex_kernel/generated"
];

const before = await snapshotHashes();

await run("pnpm", ["--filter", "@somnicortex/ipc", "build"]);
await run("pnpm", ["--filter", "@somnicortex/ipc", "run", "generate:python"]);

const after = await snapshotHashes();
const changed = diffSnapshots(before, after);
if (changed.length > 0) {
  console.error("Contract drift detected. Regeneration changed:");
  for (const file of changed) {
    console.error(` - ${file}`);
  }
  process.exit(1);
}

console.log("Contract drift check passed: generated artifacts match source contracts.");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
      }
    });
  });
}

async function snapshotHashes() {
  const out = new Map();
  for (const rel of watchedDirs) {
    const abs = path.join(root, rel);
    await walk(abs, async (filePath) => {
      const content = await fs.readFile(filePath);
      out.set(path.relative(root, filePath), sha256(content));
    });
  }
  return out;
}

function diffSnapshots(before, after) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  const changed = [];
  for (const key of keys) {
    if (before.get(key) !== after.get(key)) {
      changed.push(key);
    }
  }
  return changed.sort();
}

async function walk(dir, onFile) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, onFile);
    } else if (entry.isFile()) {
      await onFile(full);
    }
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
