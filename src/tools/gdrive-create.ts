import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";

/**
 * Registers Google Drive create tool with the MCP server
 * Provides file creation functionality with optional folder organization
 */
export function registerGoogleDriveCreateTool(server: McpServer, props?: Props) {
  server.tool(
    "gdrive_create_content",
    {
      name: z.string().describe("Name for the new file"),
      content: z.string().describe("Content of the file"),
      parent_folder_id: z.string().optional().describe("Parent folder ID (optional)"),
      mime_type: z.string().optional().describe("MIME type of the file (default: text/plain)")
    },
    async ({ name, content, parent_folder_id, mime_type = "text/plain" }) => {
      if (!props?.accessToken) {
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
        form.append('media', new Blob([content], { type: mime_type }));
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${props.accessToken}`,
          },
          body: form,
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create file: ${response.status} ${response.statusText}`);
        }
        
        const file = await response.json();
        
        let result = `✅ Created file "${file.name}" with ID: ${file.id}\n`;
        if (file.webViewLink) result += `View: ${file.webViewLink}\n`;
        if (file.parents && file.parents.length > 0) {
          result += `Parent Folder ID: ${file.parents[0]}\n`;
        }
        result += `MIME Type: ${mime_type}\n`;
        result += `Content Size: ${content.length} characters`;
        
        return {
          content: [{ type: "text", text: result }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error creating file: ${error instanceof Error ? error.message : 'Unknown error'}` }]
        };
      }
    }
  );
}