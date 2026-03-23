import net from "node:net";
import { randomUUID } from "node:crypto";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  OperationRequest,
  OperationResponse
} from "@somnicortex/ipc";
import { JsonRpcResponseSchema, OperationResponseSchema } from "@somnicortex/ipc";
import { KernelRpcError } from "./errors.js";

export type KernelAddress =
  | string
  | { host: string; port: number };

export function parseTcpAddress(address: string): KernelAddress {
  const match = address.match(/^tcp:(\d+)$/);
  if (match) {
    return { host: "127.0.0.1", port: parseInt(match[1]!, 10) };
  }
  return address;
}

export class KernelClient {
  private readonly address: KernelAddress;

  constructor(address: string) {
    this.address = parseTcpAddress(address);
  }

  async operation(req: OperationRequest): Promise<OperationResponse> {
    const response = await this.rpcCall("kernel.operation", req);
    return OperationResponseSchema.parse(response);
  }

  async health(): Promise<Record<string, unknown>> {
    const response = await this.rpcCall("kernel.health", {});
    return response as Record<string, unknown>;
  }

  private async rpcCall(method: string, params: Record<string, unknown>): Promise<unknown> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: randomUUID(),
      method,
      params
    };
    const raw = await sendRequest(this.address, `${JSON.stringify(request)}\n`);
    const parsed = JsonRpcResponseSchema.parse(JSON.parse(raw) as JsonRpcResponse);
    if (parsed.error) {
      throw new KernelRpcError(parsed.error.code, parsed.error.message);
    }
    return parsed.result;
  }
}

function sendRequest(address: KernelAddress, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client =
      typeof address === "string"
        ? net.createConnection(address)
        : net.createConnection({ host: address.host, port: address.port });
    let data = "";
    client.on("connect", () => client.write(payload));
    client.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
      if (data.includes("\n")) {
        client.end();
        resolve(data.trim());
      }
    });
    client.on("error", reject);
    client.on("end", () => {
      if (!data) {
        reject(new Error("No data from kernel"));
      }
    });
  });
}
