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

      let authorizeUrl = "/authorize";
      let logoutUrl = "/logout";
      try {
        const redirect = env.REDIRECT_URI;
        if (redirect) {
          const u = new URL(redirect);
          authorizeUrl = `${u.origin}/authorize`;
          logoutUrl = `${u.origin}/logout`;
        }
      } catch {}

      const hasRefresh = Boolean(props.refreshToken);
      const expiryHint = typeof props.expiresIn === "number" && props.expiresIn > 0
        ? `~${Math.round(props.expiresIn / 60)} min from issuance`
        : "unknown";

      const lines = [
        `✅ Authenticated as: ${props.name} (${props.email})`,
        `User ID: ${props.sub}`,
        `Refresh token: ${hasRefresh ? "present" : "missing (re-auth recommended)"}`,
        `Access token expiry: ${expiryHint}`,
        hasRefresh
          ? "Tokens should auto-refresh on expiry."
          : `To enable auto-refresh, visit: ${authorizeUrl}`,
        `To clear approval cookies: ${logoutUrl}`,
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
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

  // Disconnect: revoke tokens with Google and provide re-auth/logout links
  server.tool(
    "auth_disconnect",
    {},
    async () => {
      if (!props) {
        return {
          content: [{ type: "text", text: "Not authenticated. Nothing to disconnect." }],
        };
      }

      const results: string[] = [];
      const revoke = async (token: string, label: string) => {
        try {
          const resp = await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token }).toString(),
          });
          if (resp.ok) {
            results.push(`Revoked ${label}`);
          } else {
            const text = await resp.text().catch(() => "");
            results.push(`Failed to revoke ${label}: ${resp.status} ${text}`);
          }
        } catch (e) {
          results.push(`Error revoking ${label}: ${e instanceof Error ? e.message : String(e)}`);
        }
      };

      if (props.refreshToken) {
        await revoke(props.refreshToken, "refresh token");
      } else {
        results.push("No refresh token present");
      }
      if (props.accessToken) {
        await revoke(props.accessToken, "access token");
      }

      let authorizeUrl = "/authorize";
      let logoutUrl = "/logout";
      try {
        const redirect = env.REDIRECT_URI;
        if (redirect) {
          const u = new URL(redirect);
          authorizeUrl = `${u.origin}/authorize`;
          logoutUrl = `${u.origin}/logout`;
        }
      } catch {}

      const message = [
        ...results,
        `Next steps:`,
        `- Clear approval cookie: ${logoutUrl}`,
        `- Reconnect account: ${authorizeUrl}`,
      ].join("\n");

      return { content: [{ type: "text", text: message }] };
    }
  );
}
