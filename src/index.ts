import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleHandler } from "./auth-handler";
import type { Props } from "./utils/upstream-utils";

export class MyMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: "UnifiedMCP - Google Workspace with OAuth",
    version: "3.0.0",
  });

  async init() {
    // Existing calculator tools (preserved for backward compatibility)
    this.server.tool(
      "add",
      {
        a: z.number().describe("First number"),
        b: z.number().describe("Second number")
      },
      async ({ a, b }) => ({
        content: [{ type: "text", text: String(a + b) }],
      })
    );

    this.server.tool(
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

    // Authentication status tool - shows OAuth info
    this.server.tool(
      "auth_status",
      {},
      async (_, context) => {
        if (!this.props) {
          return {
            content: [{ type: "text", text: "Not authenticated. Please complete OAuth flow to access Google tools." }],
          };
        }

        return {
          content: [{ 
            type: "text", 
            text: `✅ Authenticated as: ${this.props.name} (${this.props.email})\nUser ID: ${this.props.sub}` 
          }],
        };
      }
    );

    // Google user info tool
    this.server.tool(
      "google_user_info",
      {},
      async () => {
        if (!this.props) {
          return {
            content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
          };
        }

        return {
          content: [{ 
            type: "text", 
            text: `Google User Info:\n${JSON.stringify({
              sub: this.props.sub,
              name: this.props.name,
              email: this.props.email
            }, null, 2)}` 
          }],
        };
      }
    );

    // Google Drive Search and Read Tool
    this.server.tool(
      "gdrive_search_and_read", 
      {
        query: z.string().describe("Search query for Google Drive files"),
        read_content: z.boolean().optional().describe("Whether to read file contents"),
        max_results: z.number().optional().describe("Maximum number of results (default: 10)")
      },
      async ({ query, read_content = false, max_results = 10 }) => {
        if (!this.props?.accessToken) {
          return {
            content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
          };
        }

        try {
          const params = new URLSearchParams({
            q: query,
            pageSize: max_results.toString(),
            fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)'
          });
          
          const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
            headers: {
              'Authorization': `Bearer ${this.props.accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json() as { files?: any[] };
          const files = data.files || [];
          
          let result = `Found ${files.length} files matching "${query}":\n\n`;
          
          for (const file of files) {
            result += `📄 **${file.name}** (${file.mimeType})\n`;
            result += `   ID: ${file.id}\n`;
            if (file.size) result += `   Size: ${file.size} bytes\n`;
            if (file.modifiedTime) result += `   Modified: ${file.modifiedTime}\n`;
            if (file.webViewLink) result += `   Link: ${file.webViewLink}\n`;
            
            if (read_content && file.mimeType.startsWith('text/')) {
              try {
                const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
                  headers: {
                    'Authorization': `Bearer ${this.props.accessToken}`,
                  },
                });
                const content = await contentResponse.text();
                result += `   Content Preview: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}\n`;
              } catch (error) {
                result += `   Content: Unable to read (${error instanceof Error ? error.message : 'Unknown error'})\n`;
              }
            }
            result += '\n';
          }
          
          return { content: [{ type: "text", text: result }] };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error searching Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );

    // Google Drive Create Content Tool
    this.server.tool(
      "gdrive_create_content",
      {
        name: z.string().describe("Name for the new file"),
        content: z.string().describe("Content of the file"),
        parent_folder_id: z.string().optional().describe("Parent folder ID (optional)")
      },
      async ({ name, content, parent_folder_id }) => {
        if (!this.props?.accessToken) {
          return {
            content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
          };
        }

        try {
          const metadata: any = { name };
          if (parent_folder_id) {
            metadata.parents = [parent_folder_id];
          }
          
          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('media', new Blob([content], { type: 'text/plain' }));
          
          const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.props.accessToken}`,
            },
            body: form,
          });
          
          if (!response.ok) {
            throw new Error(`Failed to create file: ${response.status} ${response.statusText}`);
          }
          
          const file = await response.json();
          return {
            content: [{ type: "text", text: `✅ Created file "${file.name}" with ID: ${file.id}\nView: ${file.webViewLink || 'Link not available'}` }]
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error creating file: ${error instanceof Error ? error.message : 'Unknown error'}` }]
          };
        }
      }
    );
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