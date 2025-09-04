import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";
import { google, drive_v3 } from "googleapis";
import { readBodyToText } from "../utils/stream-utils";
import { refreshGoogleAccessToken } from "../utils/upstream-utils";
import { env } from "cloudflare:workers";

// Uses runtime-agnostic reader from utils

/**
 * Registers Google Drive content reading tool with the MCP server
 * Provides comprehensive content extraction with Google Apps export support
 * Follows sequential operation flow: Authentication Setup -> File Metadata -> Content Retrieval
 */
export function registerGoogleDriveReadTool(server: McpServer, props?: Props) {
  // Authentication Setup - Creates OAuth2 client using access token
  const getDriveClient = () => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: props?.accessToken, refresh_token: props?.refreshToken });
    return google.drive({ version: "v3", auth });
  };

  server.tool(
    "gdrive_read_content",
    "Read full content from Google Drive files. Exports Google Docs as text, Sheets as CSV.",
    {
      file_id: z.string().describe("Google Drive file ID to read"),
      format: z.enum(["text", "json", "raw"]).optional().default("text").describe("Output format")
    },
    async ({ file_id, format = "text" }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        const drive = getDriveClient();
        
        // Get file metadata first to determine processing approach
        const fileMetadata = await drive.files.get({
          fileId: file_id,
          fields: "id, name, mimeType, size, createdTime, modifiedTime, webViewLink",
        });

        const { name, mimeType, size, webViewLink, modifiedTime } = fileMetadata.data;

        if (!mimeType) {
          return {
            content: [{
              type: "text",
              text: `Could not determine MIME type for file: ${name} (ID: ${file_id})`
            }]
          };
        }

        let content = "";
        let exportType = mimeType;

        // Content Retrieval: Extract readable content based on file type
        
        // Handle text-based files with direct media download
        if (mimeType.startsWith("text/") ||
            mimeType === "application/json" ||
            mimeType.includes("javascript")) {
          const attempt = async () => {
            const response = await drive.files.get(
              { fileId: file_id, alt: "media" },
              { responseType: "stream" }
            );
            return readBodyToText(response.data);
          };
          try {
            content = await attempt();
          } catch (err: any) {
            const status = err?.code ?? err?.response?.status;
            const msg = String(err?.message || err);
            const canRefresh = props?.refreshToken && (status === 401 || /invalid(_|\s)?(token|grant|credentials)/i.test(msg));
            if (canRefresh) {
              const refreshed = await refreshGoogleAccessToken({
                client_id: env.GOOGLE_OAUTH_CLIENT_ID,
                client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
                refresh_token: props!.refreshToken!,
              });
              props!.accessToken = refreshed.access_token;
              if (refreshed.refresh_token) props!.refreshToken = refreshed.refresh_token;
              // Recreate client with new token
              const driveRetry = (() => {
                const auth = new google.auth.OAuth2();
                auth.setCredentials({ access_token: props!.accessToken });
                return google.drive({ version: "v3", auth });
              })();
              const resp2 = await driveRetry.files.get(
                { fileId: file_id, alt: "media" },
                { responseType: "stream" }
              );
              content = await readBodyToText(resp2.data);
            } else {
              throw err;
            }
          }
        }
        // Handle Google Docs/Sheets with export functionality
        else if (mimeType === "application/vnd.google-apps.document" ||
                 mimeType === "application/vnd.google-apps.spreadsheet") {
          const exportMimeType = mimeType === "application/vnd.google-apps.spreadsheet"
            ? "text/csv" : "text/plain";
          exportType = exportMimeType;
          
          const attempt = async () => {
            const response = await drive.files.export(
              { fileId: file_id, mimeType: exportMimeType },
              { responseType: "stream" }
            );
            return readBodyToText(response.data);
          };
          try {
            content = await attempt();
          } catch (err: any) {
            const status = err?.code ?? err?.response?.status;
            const msg = String(err?.message || err);
            const canRefresh = props?.refreshToken && (status === 401 || /invalid(_|\s)?(token|grant|credentials)/i.test(msg));
            if (canRefresh) {
              const refreshed = await refreshGoogleAccessToken({
                client_id: env.GOOGLE_OAUTH_CLIENT_ID,
                client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
                refresh_token: props!.refreshToken!,
              });
              props!.accessToken = refreshed.access_token;
              if (refreshed.refresh_token) props!.refreshToken = refreshed.refresh_token;
              const driveRetry = (() => {
                const auth = new google.auth.OAuth2();
                auth.setCredentials({ access_token: props!.accessToken });
                return google.drive({ version: "v3", auth });
              })();
              const resp2 = await driveRetry.files.export(
                { fileId: file_id, mimeType: exportMimeType },
                { responseType: "stream" }
              );
              content = await readBodyToText(resp2.data);
            } else {
              throw err;
            }
          }
        }
        // Handle other file types
        else {
          content = "Content preview is not available for this file type.";
        }

        // Format response based on requested format
        const fileSize = size ? `${(parseInt(size) / 1024).toFixed(2)} KB` : "N/A";
        let result = `📄 **${name}** (${mimeType})\n`;
        result += `File ID: ${file_id}\n`;
        result += `Size: ${fileSize}\n`;
        if (modifiedTime) result += `Modified: ${modifiedTime}\n`;
        if (webViewLink) result += `Link: ${webViewLink}\n`;
        if (exportType !== mimeType) result += `Exported as: ${exportType}\n`;
        result += "\n";
        
        if (format === "json") {
          result += `Content (JSON):\n\`\`\`json\n${JSON.stringify({
            metadata: fileMetadata.data,
            content: content
          }, null, 2)}\n\`\`\``;
        } else if (format === "raw") {
          result += `Raw Content:\n${content}`;
        } else {
          result += `Content:\n\`\`\`\n${content}\n\`\`\``;
        }

        return { content: [{ type: "text", text: result }] };
      } catch (error: any) {
        console.error("Error reading Google Drive file:", error);
        return {
          content: [{ type: "text", text: `Error reading Google Drive file: ${error.message || String(error)}` }]
        };
      }
    }
  );
}
