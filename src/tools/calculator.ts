import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";

/**
 * Registers calculator tools with the MCP server
 * Preserved for backward compatibility with existing PRP requirements
 */
export function registerCalculatorTools(server: McpServer, props?: Props) {
  // Simple addition tool
  server.tool(
    "add",
    {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number")
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    })
  );

  // Advanced calculator tool with expression evaluation
  server.tool(
    "calculate",
    {
      expression: z.string().describe("Mathematical expression to evaluate (e.g., '2 + 3 * 4')")
    },
    async ({ expression }) => {
      try {
        // Simple safe evaluation for basic arithmetic
        const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
        const result = Function(`"use strict"; return (${sanitized})`)();
        return {
          content: [{ type: "text", text: String(result) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error evaluating expression: ${error}` }],
        };
      }
    }
  );
}