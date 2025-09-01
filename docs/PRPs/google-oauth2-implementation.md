# Google OAuth2 Integration PRP

**name**: "Google OAuth2 Integration for UnifiedMCP Cloudflare Workers Server"
**description**: |

## Purpose
Implement Google OAuth2 authentication flow on the existing Cloudflare Workers MCP server to enable secure access to Google Workspace APIs, preparing the foundation for Phase 2 Google Workspace tools integration.

## Core Principles
1. **Security First**: Implement proper OAuth2 PKCE flow with secure token handling
2. **Cloudflare Native**: Use Cloudflare OAuth Provider and KV storage for token persistence
3. **Multi-User Ready**: Support multiple users with isolated token storage
4. **API Ready**: Prepare authentication foundation for Google Workspace API calls
5. **Progressive Enhancement**: Build on existing MCP server without breaking current functionality

---

## Goal
Extend the existing UnifiedMCP Cloudflare Workers server with Google OAuth2 authentication, enabling secure Google API access while maintaining the current MCP transport and tool functionality.

## Why
- **API Access**: Google Workspace APIs require OAuth2 authentication
- **User Isolation**: Multiple users need separate, secure token storage
- **Token Management**: Automatic refresh token handling for long-term API access
- **Security Compliance**: Follow Google's OAuth2 security best practices
- **Phase 2 Preparation**: Foundation for 6 Google Workspace tools integration

## What
A Google OAuth2-enabled MCP server with:
- Multi-user OAuth2 flow using Cloudflare OAuth Provider
- Secure token storage in Cloudflare KV
- Token refresh mechanism
- Google API client initialization
- User authentication status tracking
- Existing MCP tools preserved and enhanced with user context

### Success Criteria
- [ ] Google OAuth2 App configured in Google Console
- [ ] Cloudflare OAuth Provider integrated with Google
- [ ] Users can authenticate via OAuth2 flow
- [ ] Access and refresh tokens stored securely in KV
- [ ] Token refresh mechanism works automatically
- [ ] Authenticated users can access enhanced MCP tools
- [ ] Multiple users can authenticate independently
- [ ] Existing calculator tools continue to work

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: ai-docs/cloudflare-remote-mcp-server-guide.md
  why: Cloudflare OAuth Provider implementation patterns, authentication setup
  
- file: src/index.ts
  why: Current MCP server implementation, existing tool structure
  
- file: wrangler.jsonc
  why: Current Cloudflare Workers configuration, KV bindings setup
  
- url: https://developers.cloudflare.com/agents/model-context-protocol/authorization/
  section: OAuth Provider setup with multiple providers
  critical: Cloudflare OAuth Provider class usage and configuration
  
- url: https://developers.google.com/identity/protocols/oauth2/web-server
  section: OAuth 2.0 for Web Server Applications
  critical: Authorization code flow, token exchange, refresh tokens
  
- file: CLAUDE.md
  section: Development commands, project structure, validation requirements
  why: Project follows specific patterns and validation gates
```

### Current Codebase Tree
```bash
unified-remote-mcp/.conductor/google-oauth-implementation/
├── package.json              # Current dependencies: @modelcontextprotocol/sdk, agents, zod
├── wrangler.jsonc            # Cloudflare Workers config with Durable Objects
├── src/
│   └── index.ts             # Current MCP server with calculator tools
├── ai-docs/                 # Technical reference documentation
│   ├── cloudflare-remote-mcp-server-guide.md
│   └── [other reference docs]
└── docs/
    ├── specs/initial.md     # Phase 1 & 2 specifications
    └── PRPs/               # This PRP and methodology docs
```

### Desired Codebase Tree (Post-Implementation)
```bash
unified-remote-mcp/.conductor/google-oauth-implementation/
├── package.json              # Enhanced with Google OAuth2 dependencies
├── wrangler.jsonc           # Updated with KV namespace bindings
├── .dev.vars               # Local Google OAuth credentials
├── src/
│   ├── index.ts            # Enhanced MCP server with OAuth integration
│   ├── auth/
│   │   ├── google-oauth.ts # Google OAuth2 implementation
│   │   └── token-manager.ts # Token storage and refresh logic
│   ├── lib/
│   │   └── google-client.ts # Google API client initialization
│   └── types/
│       └── auth.ts         # Authentication type definitions
└── [existing files unchanged]
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Google OAuth2 Configuration
// CORRECT: Use web application credentials, not other types
// CLIENT_ID: Ends with .apps.googleusercontent.com
// REDIRECT_URI: Must match exactly what's registered in Google Console

// GOTCHA: Token Storage in Cloudflare KV
// CORRECT: Use user-specific keys for token isolation
// PATTERN: `google_tokens:${userId}` as KV key
// ENCRYPT: Store tokens encrypted, never plain text

// GOTCHA: Refresh Token Handling
// CRITICAL: Refresh tokens can become invalid
// HANDLE: Check for refresh failures and re-authenticate
// STORE: Keep refresh tokens secure and persistent

// GOTCHA: Scope Management
// CORRECT: Request minimal scopes initially
// PATTERN: Incremental authorization for additional scopes
// LIST: 'openid email profile' for basic authentication
```

## Implementation Blueprint

### Data Models and Structure
```typescript
// Authentication interfaces
interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  google_tokens?: GoogleTokens;
}

// Enhanced MCP server with authentication
export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "Unified Remote MCP",
    version: "2.0.0"
  });

  async init() {
    // Existing calculator tools (preserved)
    this.server.tool("add", ...);
    this.server.tool("calculate", ...);
    
    // New authenticated tools
    this.server.tool("google_user_info", {}, async () => {
      const user = await this.getAuthenticatedUser();
      return { content: [{ type: "text", text: JSON.stringify(user) }] };
    });
  }
}

// OAuth Provider configuration
const oauthProvider = new OAuthProvider({
  apiRoute: "/sse",
  apiHandler: MyMCP.Router,
  defaultHandler: GoogleHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
});
```

### Implementation Tasks (Ordered)
```yaml
Task 1 - Google OAuth App Setup:
  ACTION: Create Google OAuth2 credentials in Google Cloud Console
  CONFIGURE: Web application with proper redirect URIs
  SCOPES: 'openid email profile' for initial setup
  RESULT: CLIENT_ID and CLIENT_SECRET for local and production

Task 2 - Update Dependencies:
  ADD: No additional dependencies needed (using built-in fetch)
  UPDATE: wrangler.jsonc with KV namespace bindings
  SETUP: .dev.vars with Google OAuth credentials
  RESULT: Environment properly configured

Task 3 - Implement Google OAuth Handler:
  CREATE: src/auth/google-oauth.ts
  IMPLEMENT: Authorization URL generation
  IMPLEMENT: Token exchange with authorization code
  IMPLEMENT: User profile retrieval
  RESULT: Complete OAuth2 flow implementation

Task 4 - Token Management System:
  CREATE: src/auth/token-manager.ts
  IMPLEMENT: Secure token storage in KV
  IMPLEMENT: Token refresh mechanism
  IMPLEMENT: Token validation and expiry checking
  RESULT: Persistent, secure token management

Task 5 - Enhance MCP Server:
  MODIFY: src/index.ts to integrate OAuth provider
  ADD: User authentication middleware
  ENHANCE: Existing tools with user context
  ADD: New authenticated-only tools
  RESULT: OAuth-enabled MCP server

Task 6 - Testing & Validation:
  TEST: OAuth flow end-to-end
  VERIFY: Token storage and retrieval
  VERIFY: Token refresh functionality
  TEST: Multi-user isolation
  RESULT: Fully functional OAuth2 integration
```

### Per Task Implementation Details

```typescript
// Task 1 - Google Console Configuration
/*
1. Go to Google Cloud Console → Credentials
2. Create OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized redirect URIs:
   - http://localhost:8788/oauth/callback (local)
   - https://your-worker.workers.dev/oauth/callback (production)
5. Note CLIENT_ID and CLIENT_SECRET
*/

// Task 3 - Google OAuth Handler Implementation
export class GoogleOAuthHandler {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  generateAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri
      })
    });
    return response.json();
  }
}

// Task 4 - Token Manager Implementation
export class TokenManager {
  constructor(private kv: KVNamespace) {}

  async storeTokens(userId: string, tokens: GoogleTokens): Promise<void> {
    const key = `google_tokens:${userId}`;
    const encrypted = await this.encryptTokens(tokens);
    await this.kv.put(key, encrypted);
  }

  async refreshTokensIfNeeded(userId: string): Promise<GoogleTokens | null> {
    const tokens = await this.getTokens(userId);
    if (!tokens || Date.now() < tokens.expires_at) return tokens;
    
    // Token refresh logic here
    return this.refreshTokens(tokens.refresh_token);
  }
}

// Task 5 - Enhanced MCP Server
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // OAuth endpoints
    if (url.pathname === "/oauth/callback") {
      return handleOAuthCallback(request, env);
    }
    
    if (url.pathname === "/authorize") {
      return handleAuthorize(request, env);
    }

    // MCP endpoints with authentication
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  }
};
```

### Integration Points
```yaml
CLOUDFLARE_OAUTH:
  - provider: Cloudflare OAuth Provider
  - handlers: Custom Google OAuth handler
  - storage: Cloudflare KV for token persistence
  
GOOGLE_APIS:
  - authentication: OAuth2 with proper scopes
  - client: Authenticated fetch with bearer tokens
  - refresh: Automatic token refresh before API calls
  
MCP_TRANSPORT:
  - endpoint: /sse (unchanged)
  - authentication: User context passed to tools
  - tools: Enhanced with user-specific functionality
```

## Validation Loop

### Level 1: OAuth Flow Setup
```bash
# Update wrangler.jsonc with KV binding
# Create .dev.vars with Google OAuth credentials
# Test: npm run dev shows server starts without errors
wrangler dev
```

### Level 2: Authentication Implementation
```bash
# Implement Google OAuth handler and token manager
# Test: Can initiate OAuth flow and receive callback
# Expected: User can complete authentication flow
npm run dev
# Navigate to http://localhost:8788/authorize
```

### Level 3: Token Management
```bash
# Test: Tokens stored and retrieved from KV
# Test: Token refresh mechanism works
# Expected: Authenticated users maintain session
# Verify: Multiple users have isolated tokens
```

### Level 4: MCP Integration
```bash
# Test: MCP tools work with authenticated context
# Test: Claude Desktop connects and authenticates
# Expected: Enhanced tools show user-specific data
# Verify: Existing calculator tools still work
```

## Final Validation Checklist
- [ ] Google OAuth2 app configured correctly
- [ ] Local development OAuth flow works
- [ ] Production OAuth flow works  
- [ ] Tokens stored securely in Cloudflare KV
- [ ] Token refresh mechanism functions
- [ ] Multiple users can authenticate independently
- [ ] User context passed to MCP tools
- [ ] Existing functionality preserved
- [ ] Ready for Google Workspace API integration
- [ ] Claude Desktop integration works with authentication

---

## Anti-Patterns to Avoid
- ❌ Don't store tokens in plain text - always encrypt
- ❌ Don't ignore token expiry - implement refresh logic
- ❌ Don't use server-to-server credentials for user auth
- ❌ Don't break existing MCP tool functionality
- ❌ Don't implement Google Workspace tools yet - auth only
- ❌ Don't hardcode redirect URIs - use environment variables
- ❌ Don't forget state parameter for CSRF protection

## Scope Boundary
**Phase 2A = Google OAuth2 Authentication Only**
- Google Workspace API tools, Microsoft 365 integration = Phase 2B
- Focus: Can users authenticate with Google and get secure tokens?
- Success: OAuth2 flow works, tokens stored securely, MCP server enhanced with auth