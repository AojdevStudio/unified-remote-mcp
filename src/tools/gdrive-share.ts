import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";
import { google, drive_v3 } from "googleapis";

/**
 * Registers Google Drive sharing tool with the MCP server
 * Provides comprehensive file sharing and permissions management
 * Follows sequential operation flow: Authentication Setup -> Permission Management -> Notification
 */
export function registerGoogleDriveShareTool(server: McpServer, props?: Props) {
  // Authentication Setup - Creates OAuth2 client using access token
  const getDriveClient = () => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: props?.accessToken });
    return google.drive({ version: "v3", auth });
  };

  server.tool(
    "gdrive_share_permissions",
    "Share Google Drive files and manage permissions (grant access, list permissions, remove access).",
    {
      action: z.enum(["grant_access", "list_permissions", "remove_access"]).describe("Sharing action to perform"),
      file_id: z.string().describe("Google Drive file ID to manage sharing for"),
      email_address: z.string().email().optional().describe("Email address for grant_access/remove_access"),
      role: z.enum(["reader", "commenter", "writer", "owner"]).optional().default("reader").describe("Access role to grant"),
      send_notification: z.boolean().optional().default(true).describe("Send email notification for grant_access"),
      message: z.string().optional().describe("Custom message for notification email"),
      permission_id: z.string().optional().describe("Permission ID for remove_access (get from list_permissions)")
    },
    async ({ action, file_id, email_address, role = "reader", send_notification = true, message, permission_id }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        const drive = getDriveClient();

        switch (action) {
          case "grant_access": {
            if (!email_address) {
              return {
                content: [{ type: "text", text: "Error: email_address is required for grant_access action." }]
              };
            }

            // Create permission for the user
            await drive.permissions.create({
              fileId: file_id,
              requestBody: {
                type: "user",
                role: role,
                emailAddress: email_address,
              },
              sendNotificationEmail: send_notification,
              emailMessage: message,
              fields: "id",
            });

            // Get file name for confirmation
            const fileMeta = await drive.files.get({ 
              fileId: file_id, 
              fields: "name, webViewLink" 
            });

            let result = `✅ File '${fileMeta.data.name}' (ID: ${file_id}) shared with ${email_address} as ${role}.\\n`;
            if (fileMeta.data.webViewLink) {
              result += `Share Link: ${fileMeta.data.webViewLink}\\n`;
            }
            if (send_notification) {
              result += `📧 Email notification sent to ${email_address}`;
              if (message) {
                result += ` with custom message: "${message}"`;
              }
            } else {
              result += `📧 No email notification sent`;
            }

            return { content: [{ type: "text", text: result }] };
          }

          case "list_permissions": {
            const permissions = await drive.permissions.list({
              fileId: file_id,
              fields: "permissions(id, type, role, emailAddress, displayName)"
            });

            const fileMeta = await drive.files.get({ 
              fileId: file_id, 
              fields: "name" 
            });

            if (!permissions.data.permissions || permissions.data.permissions.length === 0) {
              return {
                content: [{ type: "text", text: `📋 No permissions found for file '${fileMeta.data.name}' (ID: ${file_id})` }]
              };
            }

            let result = `📋 Permissions for '${fileMeta.data.name}' (${permissions.data.permissions.length} entries):\\n\\n`;

            permissions.data.permissions.forEach((permission, index) => {
              result += `${index + 1}. **${permission.role?.toUpperCase()}** access\\n`;
              result += `   Permission ID: ${permission.id}\\n`;
              result += `   Type: ${permission.type}\\n`;
              
              if (permission.emailAddress) {
                result += `   Email: ${permission.emailAddress}\\n`;
              }
              if (permission.displayName) {
                result += `   Name: ${permission.displayName}\\n`;
              }
              result += "\\n";
            });

            return { content: [{ type: "text", text: result }] };
          }

          case "remove_access": {
            if (!permission_id && !email_address) {
              return {
                content: [{ 
                  type: "text", 
                  text: "Error: Either permission_id or email_address is required for remove_access action." 
                }]
              };
            }

            let targetPermissionId = permission_id;

            // If email provided but no permission ID, find the permission ID
            if (email_address && !permission_id) {
              const permissions = await drive.permissions.list({
                fileId: file_id,
                fields: "permissions(id, emailAddress)"
              });

              const targetPermission = permissions.data.permissions?.find(
                p => p.emailAddress === email_address
              );

              if (!targetPermission) {
                return {
                  content: [{ 
                    type: "text", 
                    text: `Error: No permission found for ${email_address} on this file.` 
                  }]
                };
              }

              targetPermissionId = targetPermission.id || undefined;
            }

            if (!targetPermissionId) {
              return {
                content: [{ type: "text", text: "Error: Could not determine permission ID to remove." }]
              };
            }

            // Remove the permission
            await drive.permissions.delete({
              fileId: file_id,
              permissionId: targetPermissionId
            });

            const fileMeta = await drive.files.get({ 
              fileId: file_id, 
              fields: "name" 
            });

            const identifier = email_address || `permission ${targetPermissionId}`;
            return {
              content: [{ 
                type: "text", 
                text: `❌ Removed access for ${identifier} from file '${fileMeta.data.name}' (ID: ${file_id})` 
              }]
            };
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
            content: [{ type: "text", text: `Error: File not found (ID: ${file_id})` }]
          };
        }
        if (error.code === 403) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: Insufficient permissions to modify sharing for file ${file_id}` 
            }]
          };
        }
        
        console.error("Error in Google Drive sharing:", error);
        return {
          content: [{ type: "text", text: `Error performing ${action}: ${error.message || String(error)}` }]
        };
      }
    }
  );
}