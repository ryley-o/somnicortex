import path from "node:path";
import fs from "node:fs/promises";
import { createAgentFromBirthSpec } from "@somnicortex/runtime";

const cli = parseArgs(process.argv.slice(2));
const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const agentRoot = path.resolve(cli.agentDir ?? path.join(appRoot, ".agent"));
const birthSpecPath = path.join(appRoot, "birth_spec.yaml");
const archetype = await resolveArchetypeName(birthSpecPath);
const fixturePath = path.join(repoRoot, "packages", "ipc", "fixtures", "kernel-operations.json");
const kernelPkgPath = path.join(repoRoot, "packages", "kernel-py");
const pythonBin = await resolvePythonBin();
const kernelPort = Number(process.env.SOMNI_KERNEL_PORT ?? 7150);

const agent = await createAgentFromBirthSpec(
  agentRoot,
  birthSpecPath,
  archetype,
  {
    kernelSocketPath: `tcp:${kernelPort}`,
    kernelCommand: [
      pythonBin,
      "-m",
      "somnicortex_kernel.rpc",
      "--agent-dir",
      agentRoot,
      "--tcp-port",
      String(kernelPort),
      "--fixture-file",
      fixturePath
    ],
    kernelWorkingDirectory: repoRoot,
    kernelEnv: {
      PYTHONPATH: kernelPkgPath,
      PATH: `${path.dirname(pythonBin)}:${process.env.PATH ?? ""}`
    },
    unknownToolPolicy: "allow"
  },
  { archetypeDir: path.join(appRoot, "archetypes") }
);

await agent.shutdown();
console.log(`Created default agent at ${agentRoot}`);

async function resolveArchetypeName(birthSpecFile) {
  const raw = await fs.readFile(birthSpecFile, "utf8");
  const line = raw
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("archetype:"));
  if (!line) {
    return "base";
  }
  return line.replace("archetype:", "").trim().replaceAll("\"", "").replaceAll("'", "");
}

async function resolvePythonBin() {
  const candidates = [
    "/opt/homebrew/opt/python@3.10/bin/python3.10",
    "/opt/homebrew/bin/python3.10",
    "/opt/homebrew/bin/python3",
    "python3"
  ];
  for (const candidate of candidates) {
    try {
      if (candidate.startsWith("/")) {
        await fs.access(candidate);
      }
      return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return "python3";
}

function parseArgs(argv) {
  let agentDir;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--agent-dir") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --agent-dir");
      }
      agentDir = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--agent-dir=")) {
      agentDir = arg.slice("--agent-dir=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { agentDir };
}
