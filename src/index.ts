import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GoogleHandler } from "./auth-handler";
import type { Props } from "./utils/upstream-utils";
import { registerAllTools } from "./tools";

export class MyMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: "UnifiedMCP - Google Workspace with OAuth",
    version: "3.0.0",
  });

  async init() {
    // Register all tools from modular tool files
    registerAllTools(this.server, this.props);
  }
}

const mcpHandler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        version: "3.0.0",
        features: ["google-oauth", "google-drive-tools", "mcp-protocol"]
      }), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

export default new OAuthProvider({
  apiRoute: ["/sse", "/mcp"],
  apiHandler: mcpHandler as any,
  defaultHandler: GoogleHandler as any,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});