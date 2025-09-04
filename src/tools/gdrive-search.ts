import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";
import { google, drive_v3 } from "googleapis";
import { readBodyToText } from "../utils/stream-utils";

// Uses runtime-agnostic reader from utils

/**
 * Registers Google Drive search and read tool with the MCP server
 * Provides comprehensive file search with optional content reading and export capabilities
 * Follows sequential operation flow: Authentication Setup -> File Discovery -> Content Retrieval
 */
export function registerGoogleDriveSearchTool(server: McpServer, props?: Props) {
  // Authentication Setup - Creates OAuth2 client using access token
  const getDriveClient = () => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: props?.accessToken });
    return google.drive({ version: "v3", auth });
  };

  server.tool(
    "gdrive_search_and_read",
    "Search Google Drive files with optional content reading. Supports Google Docs/Sheets export.",
    {
      query: z.string().optional().default("trashed = false").describe("Search query (e.g., 'name contains \"report\"', 'mimeType=\"image/jpeg\"')"),
      read_content: z.boolean().optional().default(false).describe("Whether to read/export file contents"),
      max_results: z.number().int().min(1).max(1000).optional().default(10).describe("Maximum number of results"),
      order_by: z.string().optional().default("modifiedTime desc").describe("Sort order (e.g., 'modifiedTime desc', 'name')"),
      fields: z.string().optional().default("files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)").describe("Response fields to include")
    },
    async ({ query, read_content = false, max_results = 10, order_by, fields }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        // File Discovery: Search and list Drive files with filtering/sorting
        const drive = getDriveClient();
        const response = await drive.files.list({
          q: query,
          pageSize: max_results,
          orderBy: order_by,
          fields: fields,
        });

        if (!response.data.files || response.data.files.length === 0) {
          return {
            content: [{ type: "text", text: "No files found matching your criteria." }],
          };
        }

        const files = response.data.files;
        let result = `Found ${files.length} files matching "${query}":\n\n`;
        
        // Process each file with optional content retrieval
        for (const file of files) {
          const size = file.size ? `${(parseInt(file.size) / 1024).toFixed(2)} KB` : "N/A";
          
          result += `📄 **${file.name}** (${file.mimeType})\n`;
          result += `   ID: ${file.id}\n`;
          result += `   Size: ${size}\n`;
          if (file.modifiedTime) result += `   Modified: ${file.modifiedTime}\n`;
          if (file.webViewLink) result += `   Link: ${file.webViewLink}\n`;
          
          // Content Retrieval: Extract readable content from files
          if (read_content) {
            try {
              let content = "";
              
              // Handle text-based files with direct media download
              if (file.mimeType?.startsWith('text/') || 
                  file.mimeType === 'application/json' ||
                  file.mimeType?.includes('javascript')) {
                const contentResponse = await drive.files.get(
                  { fileId: file.id!, alt: "media" },
                  { responseType: "stream" }
                );
                content = await readBodyToText(contentResponse.data);
              }
              // Handle Google Docs/Sheets with export functionality
              else if (file.mimeType === "application/vnd.google-apps.document" ||
                       file.mimeType === "application/vnd.google-apps.spreadsheet") {
                const exportMimeType = file.mimeType === "application/vnd.google-apps.spreadsheet" 
                  ? "text/csv" : "text/plain";
                const exportResponse = await drive.files.export(
                  { fileId: file.id!, mimeType: exportMimeType },
                  { responseType: "stream" }
                );
                content = await readBodyToText(exportResponse.data);
              }
              
              if (content) {
                const preview = content.length > 300 ? content.substring(0, 300) + "..." : content;
                result += `   Content Preview:\n${preview}\n`;
              } else {
                result += `   Content: Preview not available for this file type\n`;
              }
            } catch (error) {
              result += `   Content: Unable to read (${error instanceof Error ? error.message : 'Unknown error'})\n`;
            }
          }
          result += '\n---\n\n';
        }
        
        return { content: [{ type: "text", text: result }] };
      } catch (error: any) {
        console.error("Error searching Google Drive:", error);
        return {
          content: [{ type: "text", text: `Error searching Google Drive: ${error.message || String(error)}` }]
        };
      }
    }
  );
}
