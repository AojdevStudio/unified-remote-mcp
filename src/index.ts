import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleOAuthHandler } from "./auth/google-oauth.js";
import { TokenManager } from "./auth/token-manager.js";
import { GoogleApiClient } from "./lib/google-client.js";
import { GoogleDriveAPI, type DriveFile } from "./lib/google-drive-api.js";
import type { AuthenticatedUser, AuthState } from "./types/auth.js";

// Define our MCP agent with Google OAuth2 authentication and Drive tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "UnifiedMCP - Google Workspace with OAuth",
		version: "3.0.0",
	});

	private tokenManager?: TokenManager;
	private googleClient?: GoogleApiClient;
	private driveAPI?: GoogleDriveAPI;

	// Initialize authentication components with environment
	async setupAuth(env: Env) {
		if (!this.tokenManager && env && env.GOOGLE_CLIENT_ID) {
			const oauthHandler = new GoogleOAuthHandler(
				env.GOOGLE_CLIENT_ID,
				env.GOOGLE_CLIENT_SECRET,
				env.REDIRECT_URI || 'http://localhost:8788/oauth/callback'
			);
			this.tokenManager = new TokenManager(env.TOKENS_KV, oauthHandler);
			this.googleClient = new GoogleApiClient(this.tokenManager);
			this.driveAPI = new GoogleDriveAPI(this.googleClient);
		}
	}

	async init() {
		// Existing calculator tools (preserved for backward compatibility)
		this.server.tool(
			"add",
			{
				a: z.number().describe("First number"),
				b: z.number().describe("Second number")
			},
			async ({ a, b }) => {
				return {
					content: [{ type: "text", text: String(a + b) }],
				};
			}
		);

		this.server.tool(
			"calculate",
			{
				expression: z.string().describe("Mathematical expression to evaluate (e.g., '2 + 3 * 4')")
			},
			async ({ expression }) => {
				try {
					// Simple safe evaluation for basic arithmetic
					const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
					const result = Function(`"use strict"; return (${sanitized})`)();
					return {
						content: [{ type: "text", text: String(result) }],
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error evaluating expression: ${error}` }],
					};
				}
			}
		);

		// Authentication status tool
		this.server.tool(
			"auth_status",
			{},
			async (_, context) => {
				if (!this.tokenManager) {
					return {
						content: [{ type: "text", text: "Authentication system not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Not authenticated. Please use /authorize endpoint to authenticate." }],
					};
				}

				const tokens = await this.tokenManager.getValidTokens(userId);
				if (!tokens) {
					return {
						content: [{ type: "text", text: "Authentication expired. Please re-authenticate." }],
					};
				}

				return {
					content: [{ type: "text", text: `Authenticated as user: ${userId}` }],
				};
			}
		);

		// Google user info tool
		this.server.tool(
			"google_user_info",
			{},
			async (_, context) => {
				if (!this.googleClient) {
					return {
						content: [{ type: "text", text: "Google client not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Authentication required. Please authenticate first." }],
					};
				}

				try {
					const userInfo = await this.googleClient.getUserProfile(userId);
					return {
						content: [{ 
							type: "text", 
							text: `Google User Info:\n${JSON.stringify(userInfo, null, 2)}` 
						}],
					};
				} catch (error) {
					return {
						content: [{ 
							type: "text", 
							text: `Failed to get user info: ${error}` 
						}],
					};
				}
			}
		);

		// Google Drive Search and Read Tool
		this.server.tool(
			"gdrive_search_and_read", 
			{
				query: z.string().describe("Search query for Google Drive files"),
				read_content: z.boolean().optional().describe("Whether to read file contents"),
				max_results: z.number().optional().describe("Maximum number of results (default: 10)")
			},
			async ({ query, read_content = false, max_results = 10 }, context) => {
				if (!this.driveAPI) {
					return {
						content: [{ type: "text", text: "Google Drive API not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Authentication required. Please authenticate first." }],
					};
				}

				try {
					const files = await this.driveAPI.searchFiles(userId, query, max_results);
					
					let result = `Found ${files.length} files matching "${query}":\n\n`;
					
					for (const file of files) {
						result += `📄 **${file.name}** (${file.mimeType})\n`;
						result += `   ID: ${file.id}\n`;
						if (file.size) result += `   Size: ${file.size} bytes\n`;
						if (file.modifiedTime) result += `   Modified: ${file.modifiedTime}\n`;
						if (file.webViewLink) result += `   Link: ${file.webViewLink}\n`;
						
						if (read_content && file.mimeType.startsWith('text/')) {
							try {
								const content = await this.driveAPI.getFile(userId, file.id);
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

		// Google Drive Create Content Tool
		this.server.tool(
			"gdrive_create_content",
			{
				name: z.string().describe("Name for the new file"),
				content: z.string().describe("Content of the file"),
				parent_folder_id: z.string().optional().describe("Parent folder ID (optional)")
			},
			async ({ name, content, parent_folder_id }, context) => {
				if (!this.driveAPI) {
					return {
						content: [{ type: "text", text: "Google Drive API not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Authentication required. Please authenticate first." }],
					};
				}

				try {
					const file = await this.driveAPI.createFile(userId, name, content, parent_folder_id);
					return {
						content: [{ type: "text", text: `✅ Created file "${file.name}" with ID: ${file.id}\nView: ${file.webViewLink || 'Link not available'}` }]
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error creating file: ${error instanceof Error ? error.message : 'Unknown error'}` }]
					};
				}
			}
		);

		// Google Drive Update Content Tool
		this.server.tool(
			"gdrive_update_content",
			{
				file_id: z.string().describe("ID of the file to update"),
				content: z.string().describe("New content for the file")
			},
			async ({ file_id, content }, context) => {
				if (!this.driveAPI) {
					return {
						content: [{ type: "text", text: "Google Drive API not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Authentication required. Please authenticate first." }],
					};
				}

				try {
					await this.driveAPI.updateFile(userId, file_id, content);
					return {
						content: [{ type: "text", text: `✅ Updated file ${file_id} successfully` }]
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error updating file: ${error instanceof Error ? error.message : 'Unknown error'}` }]
					};
				}
			}
		);

		// Google Drive Manage Folders Tool
		this.server.tool(
			"gdrive_manage_folders",
			{
				action: z.enum(["create", "list"]).describe("Action to perform"),
				folder_name: z.string().optional().describe("Name for new folder (required for create)"),
				parent_folder_id: z.string().optional().describe("Parent folder ID (optional)")
			},
			async ({ action, folder_name, parent_folder_id }, context) => {
				if (!this.driveAPI) {
					return {
						content: [{ type: "text", text: "Google Drive API not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Authentication required. Please authenticate first." }],
					};
				}

				try {
					if (action === "create") {
						if (!folder_name) {
							return {
								content: [{ type: "text", text: "Error: folder_name is required for create action" }]
							};
						}
						const folder = await this.driveAPI.createFolder(userId, folder_name, parent_folder_id);
						return {
							content: [{ type: "text", text: `📁 Created folder "${folder.name}" with ID: ${folder.id}` }]
						};
					} else if (action === "list") {
						const folders = await this.driveAPI.searchFiles(userId, "mimeType='application/vnd.google-apps.folder'", 50);
						let result = `📁 Found ${folders.length} folders:\n\n`;
						for (const folder of folders) {
							result += `📁 **${folder.name}** (ID: ${folder.id})\n`;
							if (folder.modifiedTime) result += `   Modified: ${folder.modifiedTime}\n`;
						}
						return {
							content: [{ type: "text", text: result }]
						};
					}
					
					return {
						content: [{ type: "text", text: "Error: Invalid action specified" }]
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error managing folders: ${error instanceof Error ? error.message : 'Unknown error'}` }]
					};
				}
			}
		);

		// Google Drive Share Permissions Tool  
		this.server.tool(
			"gdrive_share_permissions",
			{
				file_id: z.string().describe("ID of the file to share"),
				email: z.string().describe("Email address to share with"),
				role: z.enum(["reader", "writer", "commenter"]).optional().describe("Permission role (default: reader)")
			},
			async ({ file_id, email, role = "reader" }, context) => {
				if (!this.driveAPI) {
					return {
						content: [{ type: "text", text: "Google Drive API not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Authentication required. Please authenticate first." }],
					};
				}

				try {
					await this.driveAPI.shareFile(userId, file_id, email, role);
					return {
						content: [{ type: "text", text: `✅ Shared file ${file_id} with ${email} as ${role}` }]
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error sharing file: ${error instanceof Error ? error.message : 'Unknown error'}` }]
					};
				}
			}
		);

		// Google Drive Export Convert Tool
		this.server.tool(
			"gdrive_export_convert",
			{
				file_id: z.string().describe("ID of the Google Workspace file to export"),
				format: z.enum(["pdf", "docx", "xlsx", "pptx", "txt", "html", "csv"]).describe("Export format")
			},
			async ({ file_id, format }, context) => {
				if (!this.driveAPI) {
					return {
						content: [{ type: "text", text: "Google Drive API not initialized" }],
					};
				}

				const userId = this.getUserId(context);
				if (!userId) {
					return {
						content: [{ type: "text", text: "Authentication required. Please authenticate first." }],
					};
				}

				try {
					// Map format to MIME type
					const mimeTypes: Record<string, string> = {
						pdf: 'application/pdf',
						docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
						xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
						pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
						txt: 'text/plain',
						html: 'text/html',
						csv: 'text/csv'
					};
					
					const mimeType = mimeTypes[format];
					if (!mimeType) {
						return {
							content: [{ type: "text", text: `Error: Unsupported format ${format}` }]
						};
					}
					
					const exportedContent = await this.driveAPI.exportFile(userId, file_id, mimeType);
					
					// For text-based formats, show a preview
					if (format === 'txt' || format === 'html' || format === 'csv') {
						const preview = exportedContent.length > 1000 
							? exportedContent.substring(0, 1000) + '...\n[Content truncated]'
							: exportedContent;
						
						return {
							content: [{ type: "text", text: `✅ Exported file ${file_id} as ${format}:\n\n${preview}` }]
						};
					} else {
						return {
							content: [{ type: "text", text: `✅ Exported file ${file_id} as ${format}. Binary content (${exportedContent.length} characters).` }]
						};
					}
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error exporting file: ${error instanceof Error ? error.message : 'Unknown error'}` }]
					};
				}
			}
		);
	}

	// Override fetch to ensure authentication is initialized
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		try {
			await this.setupAuth(env);
		} catch (error) {
			console.warn('Auth setup failed, continuing without OAuth:', error);
		}
		return super.fetch(request, env, ctx);
	}

	// Extract user ID from MCP context (simplified for now)
	private getUserId(context: any): string | null {
		// In a real implementation, this would extract user ID from the authenticated context
		// For now, we'll use a simple approach based on request headers or session
		return context?.props?.userId || null;
	}
}

// OAuth endpoint handlers
async function handleAuthorize(request: Request, env: Env): Promise<Response> {
	try {
		const oauthHandler = new GoogleOAuthHandler(
			env.GOOGLE_CLIENT_ID,
			env.GOOGLE_CLIENT_SECRET,
			env.REDIRECT_URI || 'http://localhost:8788/oauth/callback'
		);
		const tokenManager = new TokenManager(env.TOKENS_KV, oauthHandler);

		// Generate state for CSRF protection
		const state = oauthHandler.generateState();
		
		// Store auth state
		const authState: AuthState = {
			state,
			redirect_uri: env.REDIRECT_URI || 'http://localhost:8788/oauth/callback',
			created_at: Date.now()
		};
		await tokenManager.storeAuthState(state, authState);

		// Generate authorization URL
		const authUrl = oauthHandler.generateAuthUrl(state);

		return new Response(null, {
			status: 302,
			headers: {
				'Location': authUrl,
			},
		});
	} catch (error) {
		console.error('Authorization error:', error);
		return new Response(`Authorization error: ${error}`, { status: 500 });
	}
}

async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		
		if (!code || !state) {
			return new Response('Missing authorization code or state', { status: 400 });
		}

		const oauthHandler = new GoogleOAuthHandler(
			env.GOOGLE_CLIENT_ID,
			env.GOOGLE_CLIENT_SECRET,
			env.REDIRECT_URI || 'http://localhost:8788/oauth/callback'
		);
		const tokenManager = new TokenManager(env.TOKENS_KV, oauthHandler);

		// Validate state parameter
		const authState = await tokenManager.getAuthState(state);
		if (!authState) {
			return new Response('Invalid or expired state parameter', { status: 400 });
		}

		// Check for OAuth errors
		const oauthError = oauthHandler.parseOAuthError(url.searchParams);
		if (oauthError) {
			await tokenManager.removeAuthState(state);
			return new Response(`OAuth error: ${oauthError.error} - ${oauthError.error_description || 'Unknown error'}`, { status: 400 });
		}

		// Exchange code for tokens
		const tokens = await oauthHandler.exchangeCodeForTokens(code);
		
		// Get user info
		const userInfo = await oauthHandler.getUserInfo(tokens.access_token);
		
		// Store tokens with user ID
		await tokenManager.storeTokens(userInfo.sub, tokens);
		
		// Clean up auth state
		await tokenManager.removeAuthState(state);

		return new Response(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Authentication Successful</title>
				<style>
					body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
					.success { color: #28a745; }
					.info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
				</style>
			</head>
			<body>
				<h1 class="success">✅ Authentication Successful!</h1>
				<div class="info">
					<h3>Welcome, ${userInfo.name}!</h3>
					<p>Email: ${userInfo.email}</p>
					<p>User ID: ${userInfo.sub}</p>
				</div>
				<p>You can now use the MCP tools that require Google authentication.</p>
				<p>You can close this tab and return to your application.</p>
			</body>
			</html>
		`, {
			headers: {
				'Content-Type': 'text/html',
			},
		});
	} catch (error) {
		console.error('OAuth callback error:', error);
		return new Response(`Authentication failed: ${error}`, { status: 500 });
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// OAuth endpoints
		if (url.pathname === "/authorize") {
			return handleAuthorize(request, env);
		}

		if (url.pathname === "/oauth/callback") {
			return handleOAuthCallback(request, env);
		}

		// MCP endpoints
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		// Health check endpoint
		if (url.pathname === "/health") {
			return new Response(JSON.stringify({
				status: "healthy",
				version: "3.0.0",
				features: ["google-oauth", "google-drive-tools", "mcp-protocol"]
			}), {
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}

		return new Response("Not found", { status: 404 });
	},
};