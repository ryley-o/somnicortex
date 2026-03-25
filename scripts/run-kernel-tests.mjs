import { spawnSync } from "node:child_process";

const candidates = [
  process.env.PYTHON_BIN,
  "/opt/homebrew/opt/python@3.10/bin/python3.10",
  "/opt/homebrew/bin/python3.10",
  "/opt/homebrew/bin/python3",
  "python3"
].filter(Boolean);

let selected = null;
for (const candidate of candidates) {
  const check = spawnSync(candidate, ["-m", "pytest", "--version"], {
    stdio: "ignore",
    env: process.env
  });
  if (check.status === 0) {
    selected = candidate;
    break;
  }
}

if (!selected) {
  console.error("No Python interpreter with pytest available.");
  process.exit(1);
}

const run = spawnSync(selected, ["-m", "pytest", "packages/kernel-py/tests", "-v"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PYTHONPATH: "packages/kernel-py"
  }
});

process.exit(run.status ?? 1);
