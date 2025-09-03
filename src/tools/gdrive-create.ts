import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";
import { google, drive_v3 } from "googleapis";

/**
 * Registers Google Drive file creation tool with the MCP server
 * Provides comprehensive file creation with Google Apps support
 * Follows sequential operation flow: Authentication Setup -> File Creation -> Metadata Response
 */
export function registerGoogleDriveCreateTool(server: McpServer, props?: Props) {
  // Authentication Setup - Creates OAuth2 client using access token
  const getDriveClient = () => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: props?.accessToken });
    return google.drive({ version: "v3", auth });
  };

  server.tool(
    "gdrive_create_content",
    "Create new files in Google Drive (text files or Google Docs/Sheets).",
    {
      name: z.string().describe("Name for the new file"),
      content: z.string().optional().describe("Text content for the file (ignored for Google Apps types)"),
      mime_type: z.string().optional().default("text/plain").describe("MIME type (e.g., 'text/plain', 'application/vnd.google-apps.document')"),
      parent_folder_id: z.string().optional().describe("ID of the folder to create the file in")
    },
    async ({ name, content, mime_type = "text/plain", parent_folder_id }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        const drive = getDriveClient();
        
        // Build file metadata object
        const fileMetadata: drive_v3.Schema$File = { name };
        if (parent_folder_id) {
          fileMetadata.parents = [parent_folder_id];
        }

        let response;
        
        // File Creation: Handle different file types with appropriate methods
        
        // Handle Google Apps types (Docs, Sheets, etc.) - no content upload needed
        if (mime_type.startsWith("application/vnd.google-apps")) {
          fileMetadata.mimeType = mime_type;
          response = await drive.files.create({
            requestBody: fileMetadata,
            fields: "id, name, webViewLink, mimeType, parents",
          });
          
          const { id, webViewLink, mimeType: createdMimeType, parents } = response.data;
          let result = `✅ Created ${createdMimeType} '${name}'\n`;
          result += `ID: ${id}\n`;
          if (webViewLink) result += `Link: ${webViewLink}\n`;
          if (parents && parents.length > 0) {
            result += `Parent Folder: ${parents[0]}\n`;
          }
          result += `Type: Google Apps document (no content upload required)`;
          
          return {
            content: [{ type: "text", text: result }]
          };
        }
        // Handle regular files with content upload
        else {
          if (content === undefined) {
            return {
              content: [{
                type: "text",
                text: "Error: Content is required for non-Google Apps file types."
              }]
            };
          }
          
          response = await drive.files.create({
            requestBody: fileMetadata,
            media: {
              mimeType: mime_type,
              body: content,
            },
            fields: "id, name, webViewLink, mimeType, size, parents",
          });
          
          const { id, webViewLink, mimeType: createdMimeType, size, parents } = response.data;
          const fileSize = size ? `${(parseInt(size) / 1024).toFixed(2)} KB` : "N/A";
          
          let result = `✅ Created file '${name}' (${createdMimeType})\n`;
          result += `ID: ${id}\n`;
          result += `Size: ${fileSize}\n`;
          if (webViewLink) result += `Link: ${webViewLink}\n`;
          if (parents && parents.length > 0) {
            result += `Parent Folder: ${parents[0]}\n`;
          }
          result += `Content: ${content.length} characters uploaded`;
          
          return {
            content: [{ type: "text", text: result }]
          };
        }
      } catch (error: any) {
        console.error("Error creating Google Drive file:", error);
        return {
          content: [{ type: "text", text: `Error creating file '${name}': ${error.message || String(error)}` }]
        };
      }
    }
  );
}