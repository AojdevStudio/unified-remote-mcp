import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";

/**
 * Registers Google Drive search tool with the MCP server
 * Provides file search functionality with optional content preview
 */
export function registerGoogleDriveSearchTool(server: McpServer, props?: Props) {
  server.tool(
    "gdrive_search_and_read", 
    {
      query: z.string().describe("Search query for Google Drive files"),
      read_content: z.boolean().optional().describe("Whether to read file contents"),
      max_results: z.number().optional().describe("Maximum number of results (default: 10)")
    },
    async ({ query, read_content = false, max_results = 10 }) => {
      if (!props?.accessToken) {
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
            'Authorization': `Bearer ${props.accessToken}`,
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
                  'Authorization': `Bearer ${props.accessToken}`,
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
}