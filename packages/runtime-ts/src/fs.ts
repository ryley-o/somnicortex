import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown
): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

export async function appendJsonl(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await exists(filePath))) {
    return fallback;
  }
  const txt = await fs.readFile(filePath, "utf8");
  return JSON.parse(txt) as T;
}

export async function readJsonlLastLine(filePath: string): Promise<string> {
  if (!(await exists(filePath))) {
    return "";
  }
  const txt = await fs.readFile(filePath, "utf8");
  const lines = txt.trim().split("\n").filter(Boolean);
  return lines.length ? (lines[lines.length - 1] ?? "") : "";
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
