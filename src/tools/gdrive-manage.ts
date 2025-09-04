import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";
import { google, type drive_v3 } from "googleapis";

/**
 * Registers Google Drive file management tool with the MCP server
 * Provides comprehensive file management including folders and deletion
 * Follows sequential operation flow: Authentication Setup -> File Management -> Status Response
 */
export function registerGoogleDriveManageTool(server: McpServer, props?: Props) {
  // Authentication Setup - Creates OAuth2 client using access token
  const getDriveClient = () => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: props?.accessToken });
    return google.drive({ version: "v3", auth });
  };

  server.tool(
    "gdrive_manage_folders",
    "Manage Google Drive folders and file organization (create folders, delete files, move files).",
    {
      action: z.enum(["create_folder", "delete_file", "move_file", "list_folder_contents"]).describe("Management action to perform"),
      name: z.string().optional().describe("Name for new folder (required for create_folder)"),
      file_id: z.string().optional().describe("File/folder ID (required for delete_file, move_file, list_folder_contents)"),
      parent_folder_id: z.string().optional().describe("Parent folder ID for create_folder or move_file destination"),
      permanently_delete: z.boolean().optional().default(false).describe("Permanent deletion instead of trash (for delete_file)")
    },
    async ({ action, name, file_id, parent_folder_id, permanently_delete = false }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        const drive = getDriveClient();

        switch (action) {
          case "create_folder": {
            if (!name) {
              return {
                content: [{ type: "text", text: "Error: Folder name is required for create_folder action." }]
              };
            }

            const folderMetadata: drive_v3.Schema$File = {
              name,
              mimeType: "application/vnd.google-apps.folder",
            };
            
            if (parent_folder_id) {
              folderMetadata.parents = [parent_folder_id];
            }

            const response = await drive.files.create({
              requestBody: folderMetadata,
              fields: "id, name, webViewLink, parents",
            });

            const { id, webViewLink, parents } = response.data;
            let result = `📁 Created folder '${name}'\\n`;
            result += `Folder ID: ${id}\\n`;
            if (webViewLink) result += `Link: ${webViewLink}\\n`;
            if (parents && parents.length > 0) {
              result += `Parent Folder: ${parents[0]}`;
            }

            return { content: [{ type: "text", text: result }] };
          }

          case "delete_file": {
            if (!file_id) {
              return {
                content: [{ type: "text", text: "Error: file_id is required for delete_file action." }]
              };
            }

            // Get file info before deletion for confirmation
            const fileInfo = await drive.files.get({
              fileId: file_id,
              fields: "name, mimeType"
            });

            if (permanently_delete) {
              await drive.files.delete({ fileId: file_id });
              return {
                content: [{ 
                  type: "text", 
                  text: `🗑️ File '${fileInfo.data.name}' (ID: ${file_id}) permanently deleted.` 
                }]
              };
            } else {
              await drive.files.update({ 
                fileId: file_id, 
                requestBody: { trashed: true } 
              });
              return {
                content: [{ 
                  type: "text", 
                  text: `🗑️ File '${fileInfo.data.name}' (ID: ${file_id}) moved to trash.` 
                }]
              };
            }
          }

          case "move_file": {
            if (!file_id || !parent_folder_id) {
              return {
                content: [{ 
                  type: "text", 
                  text: "Error: Both file_id and parent_folder_id are required for move_file action." 
                }]
              };
            }

            // Get current parents to remove them
            const file = await drive.files.get({
              fileId: file_id,
              fields: "parents, name"
            });

            const previousParents = file.data.parents?.join(',');

            const response = await drive.files.update({
              fileId: file_id,
              addParents: parent_folder_id,
              removeParents: previousParents,
              fields: "id, name, parents"
            });

            return {
              content: [{ 
                type: "text", 
                text: `📦 Moved file '${response.data.name}' to folder ${parent_folder_id}` 
              }]
            };
          }

          case "list_folder_contents": {
            if (!file_id) {
              return {
                content: [{ type: "text", text: "Error: file_id (folder ID) is required for list_folder_contents action." }]
              };
            }

            const response = await drive.files.list({
              q: `'${file_id}' in parents and trashed = false`,
              fields: "files(id, name, mimeType, modifiedTime, size, webViewLink)",
              orderBy: "folder,name"
            });

            const files = response.data.files || [];
            
            if (files.length === 0) {
              return {
                content: [{ type: "text", text: `📂 Folder is empty (ID: ${file_id})` }]
              };
            }

            let result = `📂 Folder contents (${files.length} items):\\n\\n`;
            
            files.forEach(file => {
              const isFolder = file.mimeType === "application/vnd.google-apps.folder";
              const icon = isFolder ? "📁" : "📄";
              const size = file.size ? `(${(parseInt(file.size) / 1024).toFixed(2)} KB)` : "";
              
              result += `${icon} **${file.name}** ${size}\\n`;
              result += `   ID: ${file.id}\\n`;
              result += `   Type: ${file.mimeType}\\n`;
              if (file.modifiedTime) result += `   Modified: ${file.modifiedTime}\\n`;
              result += "\\n";
            });

            return { content: [{ type: "text", text: result }] };
          }

          default:
            return {
              content: [{ type: "text", text: `Error: Unknown action '${action}'` }]
            };
        }
      } catch (error: any) {
        // Handle specific error cases
        if (error.code === 404) {
          return {
            content: [{ type: "text", text: `Error: File or folder not found (ID: ${file_id || 'unknown'})` }]
          };
        }
        
        console.error("Error in Google Drive management:", error);
        return {
          content: [{ type: "text", text: `Error performing ${action}: ${error.message || String(error)}` }]
        };
      }
    }
  );
}