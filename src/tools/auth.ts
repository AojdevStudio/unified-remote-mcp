import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props } from "../utils/upstream-utils";
import { env } from "cloudflare:workers";

/**
 * Registers authentication status tools with the MCP server
 * Provides OAuth flow status and user information
 */
export function registerAuthTools(server: McpServer, props?: Props) {
  // Authentication status tool - shows OAuth info
  server.tool(
    "auth_status",
    {},
    async (_, context) => {
      if (!props) {
        return {
          content: [{ type: "text", text: "Not authenticated. Please complete OAuth flow to access Google tools." }],
        };
      }

      return {
        content: [{ 
          type: "text", 
          text: `✅ Authenticated as: ${props.name} (${props.email})\nUser ID: ${props.sub}` 
        }],
      };
    }
  );

  // Google user info tool
  server.tool(
    "google_user_info",
    {},
    async () => {
      if (!props) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      return {
        content: [{ 
          type: "text", 
          text: `Google User Info:\n${JSON.stringify({
            sub: props.sub,
            name: props.name,
            email: props.email
          }, null, 2)}` 
        }],
      };
    }
  );

  // Provide a way to restart OAuth manually
  server.tool(
    "auth_restart",
    {},
    async () => {
      // Derive absolute authorize URL when possible
      let authorizeUrl = "/authorize";
      try {
        const redirect = env.REDIRECT_URI;
        if (redirect) {
          const u = new URL(redirect);
          authorizeUrl = `${u.origin}/authorize`;
        }
      } catch {
        // Fallback to relative path
      }

      const message = [
        `Click to restart OAuth: ${authorizeUrl}`,
        "This link requests offline access so tokens can auto-refresh.",
      ].join("\n");

      return {
        content: [{ type: "text", text: message }],
      };
    }
  );
}
