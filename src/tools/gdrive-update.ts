import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";
import { google, drive_v3 } from "googleapis";

/**
 * Registers Google Drive file update tool with the MCP server
 * Provides content modification functionality for existing files
 * Follows sequential operation flow: Authentication Setup -> Type Validation -> Content Updates
 */
export function registerGoogleDriveUpdateTool(server: McpServer, props?: Props) {
  // Authentication Setup - Creates OAuth2 client using access token
  const getDriveClient = () => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: props?.accessToken });
    return google.drive({ version: "v3", auth });
  };

  server.tool(
    "gdrive_update_content",
    "Update content of existing files (not applicable for Google Docs/Sheets).",
    {
      file_id: z.string().describe("Google Drive file ID to update"),
      content: z.string().describe("New text content for the file"),
      mime_type: z.string().optional().describe("Optional: New MIME type for the file")
    },
    async ({ file_id, content, mime_type }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        const drive = getDriveClient();
        
        // Type Validation: Check existing file metadata to prevent Google Apps updates
        const metadata = await drive.files.get({
          fileId: file_id,
          fields: "mimeType, name, size",
        });
        
        const { mimeType: existingMimeType, name } = metadata.data;
        
        // Prevent updates to Google Apps files (must use Google Drive interface)
        if (existingMimeType?.startsWith("application/vnd.google-apps")) {
          return {
            content: [{
              type: "text",
              text: `Cannot update content for Google Apps file type (${existingMimeType}). Use Google Drive interface to edit '${name}'.`
            }]
          };
        }

        // Content Updates: Modify existing file content via files.update()
        const response = await drive.files.update({
          fileId: file_id,
          media: {
            mimeType: mime_type || existingMimeType || "text/plain",
            body: content,
          },
          fields: "id, name, modifiedTime, size",
        });

        const { name: updatedName, modifiedTime, size } = response.data;
        const fileSize = size ? `${(parseInt(size) / 1024).toFixed(2)} KB` : "N/A";
        
        let result = `✅ File '${updatedName}' (ID: ${file_id}) content updated successfully\\n`;
        result += `Modified: ${modifiedTime}\\n`;
        result += `New Size: ${fileSize}\\n`;
        result += `Content Length: ${content.length} characters`;
        
        return {
          content: [{ type: "text", text: result }]
        };
      } catch (error: any) {
        console.error("Error updating Google Drive file:", error);
        return {
          content: [{ type: "text", text: `Error updating content for file ${file_id}: ${error.message || String(error)}` }]
        };
      }
    }
  );
}