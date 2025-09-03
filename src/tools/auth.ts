import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props } from "../utils/upstream-utils";

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
}