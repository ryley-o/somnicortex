import fs from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const packageRoot = path.resolve(import.meta.dirname, "..");
const root = path.resolve(packageRoot, "..", "..");
const schemaDir = path.join(packageRoot, "schemas");
const outputDir = path.join(
  root,
  "packages",
  "kernel-py",
  "somnicortex_kernel",
  "generated"
);

await fs.mkdir(outputDir, { recursive: true });

const schemaFiles = (await fs.readdir(schemaDir)).filter((f) =>
  f.endsWith(".schema.json")
);

for (const fileName of schemaFiles) {
  const schemaPath = path.join(schemaDir, fileName);
  const moduleName = fileName.replace(".schema.json", "").toLowerCase();
  const outputPath = path.join(outputDir, `${moduleName}.py`);
  await runDatamodelCodegen(root, schemaPath, outputPath);
}

console.log(`Generated ${schemaFiles.length} Python model files in ${outputDir}`);

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function runDatamodelCodegen(root, schemaPath, outputPath) {
  const commonArgs = [
    "--input",
    schemaPath,
    "--input-file-type",
    "jsonschema",
    "--output",
    outputPath,
    "--target-python-version",
    "3.11",
    "--output-model-type",
    "pydantic_v2.BaseModel",
    "--disable-timestamp"
  ];

  const uvAvailable = spawnSync("uv", ["--version"], { cwd: root }).status === 0;
  if (uvAvailable) {
    try {
      await run(
        "uv",
        [
          "run",
          "--project",
          "packages/kernel-py",
          "datamodel-codegen",
          ...commonArgs
        ],
        root
      );
      return;
    } catch {
      // Continue to fallback strategies below.
    }
  }

  try {
    await run(
      "python3",
      [
        "-m",
        "datamodel_code_generator",
        ...commonArgs
      ],
      root
    );
    return;
  } catch {
    await run(
      "datamodel-codegen",
      commonArgs,
      root
    );
  }
}
