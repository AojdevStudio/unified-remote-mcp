import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";

/**
 * Registers Google Drive read tool with the MCP server
 * Provides full content reading functionality for files by ID
 */
export function registerGoogleDriveReadTool(server: McpServer, props?: Props) {
  server.tool(
    "gdrive_read_content",
    {
      file_id: z.string().describe("Google Drive file ID to read"),
      format: z.enum(["text", "json", "raw"]).optional().describe("Output format (default: text)")
    },
    async ({ file_id, format = "text" }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        // First get file metadata
        const metadataResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?fields=id,name,mimeType,size,createdTime,modifiedTime,webViewLink`, {
          headers: {
            'Authorization': `Bearer ${props.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!metadataResponse.ok) {
          throw new Error(`Failed to get file metadata: ${metadataResponse.status} ${metadataResponse.statusText}`);
        }

        const metadata = await metadataResponse.json();

        // Then get file content
        const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`, {
          headers: {
            'Authorization': `Bearer ${props.accessToken}`,
          },
        });

        if (!contentResponse.ok) {
          throw new Error(`Failed to read file content: ${contentResponse.status} ${contentResponse.statusText}`);
        }

        const content = await contentResponse.text();
        
        let result = `📄 **${metadata.name}** (${metadata.mimeType})\n`;
        result += `File ID: ${metadata.id}\n`;
        if (metadata.size) result += `Size: ${metadata.size} bytes\n`;
        result += `Modified: ${metadata.modifiedTime}\n`;
        if (metadata.webViewLink) result += `Link: ${metadata.webViewLink}\n\n`;
        
        if (format === "json") {
          result += `Content (JSON):\n\`\`\`json\n${JSON.stringify({
            metadata: metadata,
            content: content
          }, null, 2)}\n\`\`\``;
        } else if (format === "raw") {
          result += `Raw Content:\n${content}`;
        } else {
          result += `Content:\n\`\`\`\n${content}\n\`\`\``;
        }

        return { content: [{ type: "text", text: result }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error reading Google Drive file: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}