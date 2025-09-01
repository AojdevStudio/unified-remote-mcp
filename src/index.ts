import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleOAuthHandler } from "./auth/google-oauth.js";
import { TokenManager } from "./auth/token-manager.js";
import { GoogleApiClient } from "./lib/google-client.js";
import type { AuthenticatedUser, AuthState } from "./types/auth.js";

// Define our MCP agent with Google OAuth2 authentication
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Unified Remote MCP with Google OAuth",
		version: "2.0.0",
	});

	private tokenManager?: TokenManager;
	private googleClient?: GoogleApiClient;

	// Initialize authentication components
	initAuth(env: Env) {
		const oauthHandler = new GoogleOAuthHandler(
			env.GOOGLE_CLIENT_ID,
			env.GOOGLE_CLIENT_SECRET,
			env.REDIRECT_URI || 'http://localhost:8788/oauth/callback'
		);
		this.tokenManager = new TokenManager(env.TOKENS_KV, oauthHandler);
		this.googleClient = new GoogleApiClient(this.tokenManager);
	}

	async init() {
		// Existing calculator tools (preserved for backward compatibility)
		this.server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
			content: [{ type: "text", text: String(a + b) }],
		}));

		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			},
		);

		// New authenticated tools
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

		// Initialize MCP server with authentication
		const mcpServer = new MyMCP();
		mcpServer.initAuth(env);

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
				version: "2.0.0",
				features: ["google-oauth", "mcp-tools"]
			}), {
				headers: {
					'Content-Type': 'application/json',
				},
			});
		}

		return new Response("Not found", { status: 404 });
	},
};
