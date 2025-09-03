import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props } from "../utils/upstream-utils";
import { registerAuthTools } from "./auth";
import { registerGoogleDriveSearchTool } from "./gdrive-search";
import { registerGoogleDriveReadTool } from "./gdrive-read";
import { registerGoogleDriveCreateTool } from "./gdrive-create";
import { registerGoogleDriveUpdateTool } from "./gdrive-update";
import { registerGoogleDriveManageTool } from "./gdrive-manage";
import { registerGoogleDriveShareTool } from "./gdrive-share";
import { registerGoogleDriveExportTool } from "./gdrive-export";

/**
 * Registers all UnifiedMCP tools with the server
 * Complete Google Workspace integration with 6 Google Drive tools + authentication
 */
export function registerAllTools(server: McpServer, props?: Props) {
  // Register authentication tools
  registerAuthTools(server, props);
  
  // Register complete Google Drive tool suite (6 tools)
  // Sequential operation flow: Authentication -> Discovery -> Content -> Management
  registerGoogleDriveSearchTool(server, props);  // File Discovery: Search and list files
  registerGoogleDriveReadTool(server, props);     // Content Retrieval: Read file contents
  registerGoogleDriveCreateTool(server, props);   // File Creation: Create new files
  registerGoogleDriveUpdateTool(server, props);   // Content Updates: Modify existing files
  registerGoogleDriveManageTool(server, props);   // File Management: Folders, delete, organize
  registerGoogleDriveShareTool(server, props);    // Sharing: Grant access and permissions
  registerGoogleDriveExportTool(server, props);   // Export: Convert Google Apps to other formats
}