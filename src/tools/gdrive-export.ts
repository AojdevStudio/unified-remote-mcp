import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Props } from "../utils/upstream-utils";
import { google, drive_v3 } from "googleapis";
import { readBodyToText } from "../utils/stream-utils";

// Uses runtime-agnostic reader from utils

/**
 * Registers Google Drive export and conversion tool with the MCP server
 * Provides comprehensive file export capabilities for Google Apps documents
 * Follows sequential operation flow: Authentication Setup -> Format Validation -> Export Processing
 */
export function registerGoogleDriveExportTool(server: McpServer, props?: Props) {
  // Authentication Setup - Creates OAuth2 client using access token
  const getDriveClient = () => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: props?.accessToken });
    return google.drive({ version: "v3", auth });
  };

  server.tool(
    "gdrive_export_convert",
    "Export and convert Google Drive files to various formats (Docs to PDF/Word, Sheets to Excel/CSV, etc.).",
    {
      file_id: z.string().describe("Google Drive file ID to export"),
      export_format: z.enum([
        "pdf", "docx", "odt", "rtf", "txt", "html", "epub",  // Document formats
        "xlsx", "csv", "tsv", "ods",                         // Spreadsheet formats  
        "pptx", "odp", "txt_presentation",                   // Presentation formats
        "zip", "png", "svg"                                  // Drawing formats
      ]).describe("Format to export to"),
      save_as_new_file: z.boolean().optional().default(false).describe("Save exported content as new file in Drive"),
      new_file_name: z.string().optional().describe("Name for new file (if save_as_new_file is true)")
    },
    async ({ file_id, export_format, save_as_new_file = false, new_file_name }) => {
      if (!props?.accessToken) {
        return {
          content: [{ type: "text", text: "Authentication required. Please complete OAuth flow first." }],
        };
      }

      try {
        const drive = getDriveClient();

        // Get file metadata to determine type and validate export capability
        const fileMetadata = await drive.files.get({
          fileId: file_id,
          fields: "id, name, mimeType, webViewLink"
        });

        const { name, mimeType, webViewLink } = fileMetadata.data;

        if (!mimeType?.startsWith("application/vnd.google-apps")) {
          return {
            content: [{
              type: "text",
              text: `❌ File '${name}' (${mimeType}) is not a Google Apps document. Export only works for Google Docs, Sheets, Slides, and Drawings.`
            }]
          };
        }

        // Format Validation: Map Google Apps types to supported export formats
        const formatMappings: Record<string, Record<string, string>> = {
          "application/vnd.google-apps.document": {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "odt": "application/vnd.oasis.opendocument.text",
            "rtf": "application/rtf",
            "txt": "text/plain",
            "html": "text/html",
            "epub": "application/epub+zip"
          },
          "application/vnd.google-apps.spreadsheet": {
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "csv": "text/csv",
            "tsv": "text/tab-separated-values",
            "ods": "application/x-vnd.oasis.opendocument.spreadsheet",
            "pdf": "application/pdf",
            "html": "text/html"
          },
          "application/vnd.google-apps.presentation": {
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "odp": "application/vnd.oasis.opendocument.presentation",
            "pdf": "application/pdf",
            "txt_presentation": "text/plain"
          },
          "application/vnd.google-apps.drawing": {
            "png": "image/png",
            "svg": "image/svg+xml",
            "pdf": "application/pdf"
          }
        };

        const supportedFormats = formatMappings[mimeType];
        if (!supportedFormats || !supportedFormats[export_format]) {
          const available = supportedFormats ? Object.keys(supportedFormats).join(", ") : "none";
          return {
            content: [{
              type: "text",
              text: `❌ Format '${export_format}' not supported for ${mimeType}. Available formats: ${available}`
            }]
          };
        }

        const exportMimeType = supportedFormats[export_format];

        // Export Processing: Convert file to requested format
        const exportResponse = await drive.files.export(
          { fileId: file_id, mimeType: exportMimeType },
          { responseType: "stream" }
        );
        const exportedContent = await readBodyToText(exportResponse.data);

        let result = `✅ Exported '${name}' from ${mimeType} to ${export_format.toUpperCase()}\\n`;
        result += `Original File ID: ${file_id}\\n`;
        result += `Export Format: ${exportMimeType}\\n`;
        result += `Exported Size: ${(exportedContent.length / 1024).toFixed(2)} KB\\n`;

        // Optional: Save exported content as new file in Drive
        if (save_as_new_file) {
          const exportedFileName = new_file_name || `${name}.${export_format}`;
          
          const createResponse = await drive.files.create({
            requestBody: { name: exportedFileName },
            media: {
              mimeType: exportMimeType,
              body: exportedContent,
            },
            fields: "id, name, webViewLink, size",
          });

          const { id: newFileId, webViewLink: newFileLink, size } = createResponse.data;
          const newFileSize = size ? `${(parseInt(size) / 1024).toFixed(2)} KB` : "N/A";
          
          result += `\\n📁 Saved as new file: '${exportedFileName}'\\n`;
          result += `New File ID: ${newFileId}\\n`;
          result += `New File Size: ${newFileSize}\\n`;
          if (newFileLink) {
            result += `New File Link: ${newFileLink}\\n`;
          }
        } else {
          // Show content preview for text-based formats
          if (exportMimeType.startsWith("text/") || 
              exportMimeType === "application/rtf" ||
              export_format === "html") {
            const preview = exportedContent.length > 500 
              ? exportedContent.substring(0, 500) + "\\n\\n[... truncated ...]"
              : exportedContent;
            result += `\\nContent Preview:\\n\`\`\`\\n${preview}\\n\`\`\``;
          } else {
            result += `\\n💾 Binary content exported successfully (${exportedContent.length} bytes)`;
            result += `\\nUse 'save_as_new_file: true' to save exported content to Drive`;
          }
        }

        if (webViewLink) {
          result += `\\n🔗 Original File: ${webViewLink}`;
        }

        return { content: [{ type: "text", text: result }] };
      } catch (error: any) {
        // Handle specific error cases
        if (error.code === 404) {
          return {
            content: [{ type: "text", text: `❌ File not found (ID: ${file_id})` }]
          };
        }
        if (error.code === 403) {
          return {
            content: [{ 
              type: "text", 
              text: `❌ Insufficient permissions to export file ${file_id}` 
            }]
          };
        }
        
        console.error("Error exporting Google Drive file:", error);
        return {
          content: [{ 
            type: "text", 
            text: `❌ Error exporting file to ${export_format}: ${error.message || String(error)}` 
          }]
        };
      }
    }
  );
}
