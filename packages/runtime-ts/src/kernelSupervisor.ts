import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { exists } from "./fs.js";
import { parseTcpAddress, type KernelAddress } from "./kernelClient.js";

export class KernelSupervisor {
  private child: ChildProcess | null = null;
  private stderrChunks: string[] = [];
  private readonly address: KernelAddress;

  constructor(
    private readonly command: string[],
    private readonly socketPath: string,
    private readonly options?: {
      cwd?: string;
      env?: Record<string, string>;
    }
  ) {
    this.address = parseTcpAddress(socketPath);
  }

  get isTcp(): boolean {
    return typeof this.address !== "string";
  }

  async start(): Promise<void> {
    if (this.child) {
      return;
    }
    const [cmd, ...args] = this.command;
    if (!cmd) {
      throw new Error("Kernel command cannot be empty");
    }
    const normalizedArgs = this.normalizeAgentDirArg(args);
    this.stderrChunks = [];
    this.child = spawn(cmd, normalizedArgs, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: this.options?.cwd,
      env: this.options?.env
        ? { ...process.env, ...this.options.env }
        : process.env
    });
    this.child.stderr?.on("data", (chunk: Buffer) => {
      this.stderrChunks.push(chunk.toString("utf8"));
    });
    const earlyExit = new Promise<never>((_, reject) => {
      this.child?.on("exit", (code) => {
        reject(
          new Error(
            `Kernel exited early (code ${code}):\n${this.stderrChunks.join("")}`
          )
        );
      });
    });
    await Promise.race([this.waitForReady(10_000), earlyExit]);
  }

  async stop(): Promise<void> {
    if (!this.child) {
      return;
    }
    this.child.kill("SIGTERM");
    this.child = null;
    if (!this.isTcp) {
      await fs.rm(this.socketPath, { force: true });
    }
  }

  private async waitForReady(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    if (this.isTcp) {
      const addr = this.address as { host: string; port: number };
      while (Date.now() < deadline) {
        const ok = await this.probeTcp(addr.host, addr.port);
        if (ok) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } else {
      while (Date.now() < deadline) {
        if (await exists(this.socketPath)) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    throw new Error(
      `Kernel did not become ready within ${timeoutMs}ms.\nKernel stderr:\n${this.stderrChunks.join("")}`
    );
  }

  private probeTcp(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = net.createConnection({ host, port });
      sock.on("connect", () => {
        sock.destroy();
        resolve(true);
      });
      sock.on("error", () => {
        sock.destroy();
        resolve(false);
      });
    });
  }

  private normalizeAgentDirArg(args: string[]): string[] {
    const normalized = [...args];
    for (let i = 0; i < normalized.length; i += 1) {
      const arg = normalized[i];
      if (!arg) {
        continue;
      }
      if (arg === "--agent-dir") {
        const value = normalized[i + 1];
        if (typeof value === "string" && value.length > 0) {
          normalized[i + 1] = path.resolve(value);
        }
        i += 1;
        continue;
      }
      if (arg.startsWith("--agent-dir=")) {
        const value = arg.slice("--agent-dir=".length);
        if (value.length > 0) {
          normalized[i] = `--agent-dir=${path.resolve(value)}`;
        }
      }
    }
    return normalized;
  }
}
