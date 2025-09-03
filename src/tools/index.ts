import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Props } from "../utils/upstream-utils";
import { registerCalculatorTools } from "./calculator";
import { registerAuthTools } from "./auth";
import { registerGoogleDriveSearchTool } from "./gdrive-search";
import { registerGoogleDriveReadTool } from "./gdrive-read";
import { registerGoogleDriveCreateTool } from "./gdrive-create";

/**
 * Registers all UnifiedMCP tools with the server
 */
export function registerAllTools(server: McpServer, props?: Props) {
  // Register individual tool categories
  registerCalculatorTools(server, props);
  registerAuthTools(server, props);
  
  // Register Google Drive tools
  registerGoogleDriveSearchTool(server, props);
  registerGoogleDriveReadTool(server, props);
  registerGoogleDriveCreateTool(server, props);
}