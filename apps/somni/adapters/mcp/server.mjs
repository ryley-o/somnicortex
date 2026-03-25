#!/usr/bin/env node
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createAgent } from "@somnicortex/runtime";

const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const defaultAgentRoot = path.join(appRoot, ".agent");

const server = new Server(
  { name: "somni-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "receive_task",
        description: "Queue and execute a task in SomniCortex",
        inputSchema: {
          type: "object",
          required: ["title"],
          properties: {
            agentRoot: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            urgency: { type: "string", enum: ["low", "normal", "high", "critical"] }
          }
        }
      },
      {
        name: "report",
        description: "Write a report payload to audit logs",
        inputSchema: {
          type: "object",
          required: ["payload"],
          properties: {
            agentRoot: { type: "string" },
            payload: { type: "object" }
          }
        }
      },
      {
        name: "get_sleep_state",
        description: "Read current sleep state",
        inputSchema: {
          type: "object",
          properties: {
            agentRoot: { type: "string" }
          }
        }
      },
      {
        name: "expose_capabilities",
        description: "Read runtime/kernel capability manifest",
        inputSchema: {
          type: "object",
          properties: {
            agentRoot: { type: "string" }
          }
        }
      },
      {
        name: "recall",
        description: "Recall memories from episodic store",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            agentRoot: { type: "string" },
            query: { type: "string" },
            topK: { type: "number" }
          }
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {});
  const agentRoot = resolveAgentRoot(args.agentRoot);

  const agent = await createAgent(agentRoot, { unknownToolPolicy: "allow" });
  try {
    if (name === "receive_task") {
      await agent.receive_task({
        id: `mcp_task_${Date.now().toString(36)}`,
        title: String(args.title ?? "Untitled Task"),
        body: String(args.body ?? ""),
        urgency: toUrgency(args.urgency),
        metadata: {}
      });
      return textResult({ accepted: true });
    }
    if (name === "report") {
      await agent.report((args.payload ?? {}));
      return textResult({ written: true });
    }
    if (name === "get_sleep_state") {
      return textResult({ sleepState: agent.get_sleep_state() });
    }
    if (name === "expose_capabilities") {
      return textResult(await agent.exposeCapabilities());
    }
    if (name === "recall") {
      const result = await agent.recall({
        query: String(args.query ?? ""),
        topK: Number(args.topK ?? 5),
        includePendingReview: false
      });
      return textResult(result);
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
  } finally {
    await agent.shutdown();
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

function resolveAgentRoot(value) {
  if (typeof value === "string" && value.length > 0) {
    return path.resolve(value);
  }
  return defaultAgentRoot;
}

function toUrgency(value) {
  if (value === "low" || value === "normal" || value === "high" || value === "critical") {
    return value;
  }
  return "normal";
}

function textResult(obj, isError = false) {
  return {
    isError,
    content: [
      {
        type: "text",
        text: JSON.stringify(obj, null, 2)
      }
    ]
  };
}
