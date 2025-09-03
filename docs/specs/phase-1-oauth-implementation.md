# Phase 1: OAuth Implementation Specification

## Executive Summary

This specification details the implementation of OAuth2 authentication for the Unified Remote MCP server, based on the proven patterns from the `google-mcp-remote` reference implementation. Phase 1 focuses on establishing a working OAuth flow with Google as the initial provider, creating the foundation for multi-provider support in future phases.

## Current State Analysis

### What We Have
- **Working MCP Server**: Basic MCP server running on Cloudflare Workers
- **Google Workspace Tools**: 6 implemented tools currently using hardcoded tokens
  - `gdrive_search_and_read`
  - `gdrive_create_content`
  - `gdrive_update_content`
  - `gdrive_manage_folders`
  - `gdrive_share_permissions`
  - `gdrive_export_convert`
- **SSE Transport**: Server-Sent Events endpoint at `/sse`
- **Durable Objects**: MyMCP class for stateful connections
- **KV Storage**: TOKENS_KV namespace already configured

### What We're Missing
- OAuth2 authentication flow
- Session management system
- Token storage and retrieval
- Auth URL delivery mechanism
- Client approval workflow

## Technical Architecture

### Core Dependencies Required

```json
{
  "@cloudflare/workers-oauth-provider": "^0.0.5",
  "googleapis": "^148.0.0",
  "hono": "^4.7.7"
}
```

### OAuth Flow Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ MCP Client  │────▶│ MCP Server   │────▶│   Google    │
│  (Claude)   │◀────│ (Cloudflare) │◀────│   OAuth2    │
└─────────────┘     └──────────────┘     └─────────────┘
      │                    │                     │
      ▼                    ▼                     ▼
  1. Connect          2. Check Auth         3. OAuth Flow
  via SSE             3. Return URL         4. Get Tokens
                      5. Store Tokens       5. Return User
```

### Session Management Design

#### Session Identification Strategy
Based on the reference implementation, we'll use:
1. **Connection-based Session ID**: Generated from MCP connection context
2. **Storage Key Pattern**: `session:{sessionId}` → OAuth tokens
3. **Expiration**: 24-hour TTL on KV entries

#### Token Storage Schema

```typescript
interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  userEmail: string;
  scope: string;
}
```

## Implementation Details

### 1. OAuth Handler Module (`src/auth/oauth-handler.ts`)

This module will handle the complete OAuth flow, adapted from the reference implementation:

```typescript
// Key components to implement:
- OAuthProvider wrapper for main export
- Authorization endpoint handler (/authorize)
- Callback handler (/callback)
- Token endpoint handler (/token)
- Client registration handler (/register)
```

#### Authorization Flow
1. Parse OAuth request from MCP client
2. Check if client already approved (via encrypted cookie)
3. If not approved, show approval dialog
4. If approved, redirect to Google OAuth with Drive scopes
5. Include MCP session info in state parameter

#### Callback Processing
1. Extract authorization code from Google
2. Exchange code for access/refresh tokens
3. Fetch user info from Google
4. Store tokens in KV by session ID
5. Complete MCP authorization flow

### 2. Utility Modules

#### `src/utils/upstream-utils.ts`
Handles communication with Google OAuth2:
- Build authorization URLs with proper scopes
- Exchange authorization codes for tokens
- Handle token refresh logic

#### `src/utils/oauth-utils.ts`
MCP-specific OAuth utilities:
- Session ID generation from connection context
- Cookie encryption for approval state
- Client approval tracking
- Render approval dialog HTML

### 3. Main Entry Point Updates (`src/index.ts`)

```typescript
// Current structure (simplified)
export class MyMCP extends McpAgent {
  // MCP implementation
}

// New structure with OAuth
export default new OAuthProvider({
  apiRoute: ["/sse", "/mcp"],
  apiHandler: mcpHandler,
  defaultHandler: GoogleOAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register"
});
```

### 4. Tool Authentication Integration

Each tool will check for valid OAuth tokens:

```typescript
async function executeToolWithAuth(context, toolName, params) {
  const tokens = await getTokensForSession(context.sessionId);

  if (!tokens || isExpired(tokens)) {
    return {
      content: [{
        type: "text",
        text: `Authentication required. Please visit: ${getAuthUrl(context)}`
      }]
    };
  }

  // Execute tool with tokens
  return executeGoogleAPICall(tokens, toolName, params);
}
```

## Configuration Requirements

### Google Cloud Console Setup

1. **Create OAuth 2.0 Client ID**
   - Type: Web application
   - Name: "Unified MCP Server"

2. **Authorized JavaScript Origins**
   ```
   https://unified-remote-mcp.{username}.workers.dev
   http://localhost:8788 (for development)
   ```

3. **Authorized Redirect URIs**
   ```
   https://unified-remote-mcp.{username}.workers.dev/callback
   http://localhost:8788/callback (for development)
   ```

4. **Enable Required APIs**
   - Google Drive API (required for all 6 tools)

### Cloudflare Configuration

#### KV Namespace Setup
```bash
# Create OAuth KV namespace
wrangler kv:namespace create OAUTH_KV

# Update wrangler.jsonc with the returned ID
```

#### Environment Secrets
```bash
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY
```

#### Updated `wrangler.jsonc`
```jsonc
{
  "kv_namespaces": [
    {
      "binding": "TOKENS_KV",
      "id": "52bb8ee9b5ee44508cefb7d021862530"
    },
    {
      "binding": "OAUTH_KV",
      "id": "{new-kv-id-here}"
    }
  ]
}
```

## Google OAuth Scopes Required

```javascript
const GOOGLE_SCOPES = [
  "profile",                                    // Basic profile info
  "email",                                      // User email address
  "https://www.googleapis.com/auth/drive",              // Full Google Drive access for all 6 tools
  "https://www.googleapis.com/auth/drive.file",         // Create and manage files
  "https://www.googleapis.com/auth/drive.readonly",     // Read-only access for search operations
  "https://www.googleapis.com/auth/drive.metadata",     // Access file metadata
];
```

### Scope Mapping to Tools
- `gdrive_search_and_read`: drive.readonly, drive.metadata
- `gdrive_create_content`: drive, drive.file
- `gdrive_update_content`: drive, drive.file
- `gdrive_manage_folders`: drive, drive.file
- `gdrive_share_permissions`: drive
- `gdrive_export_convert`: drive, drive.readonly

## Security Considerations

### Token Security
1. **Encryption at Rest**: All tokens encrypted before KV storage
2. **HTTPS Only**: Enforce HTTPS for all OAuth endpoints
3. **State Validation**: Verify state parameter to prevent CSRF
4. **Approval Cookies**: Encrypted cookies for client approval state

### Session Security
1. **Session Rotation**: New session ID on each connection
2. **TTL Enforcement**: 24-hour expiration on stored tokens
3. **Scope Limitation**: Request only necessary OAuth scopes
4. **User Isolation**: Tokens bound to specific session IDs

## Testing Strategy

### Local Development Testing
1. Create `.dev.vars` file with OAuth credentials
2. Run `wrangler dev` for local server
3. Test with MCP Inspector: `npx @modelcontextprotocol/inspector@latest`
4. Verify OAuth flow completion
5. Test token storage and retrieval

### Cloudflare Playground Testing
1. Deploy with `wrangler deploy`
2. Navigate to https://playground.ai.cloudflare.com
3. Enter MCP server URL with `/sse` endpoint
4. Complete OAuth flow
5. Test Google Drive tools with authenticated session

### End-to-End Validation
- [ ] OAuth authorization URL generation
- [ ] Approval dialog rendering
- [ ] Google OAuth redirect
- [ ] Token exchange successful
- [ ] User info retrieval
- [ ] Token storage in KV
- [ ] Session persistence
- [ ] Tool authentication check
- [ ] Token expiration handling

## Migration Path

### From Current State
1. **Preserve Existing Tools**: Keep all Google Drive tool implementations
2. **Add Auth Layer**: Wrap tools with authentication checks
3. **Backward Compatibility**: Support both token methods initially
4. **Gradual Migration**: Phase out hardcoded tokens after validation

### Data Migration
- No data migration needed for Phase 1
- Existing TOKENS_KV can coexist with new OAUTH_KV
- Clean separation between old and new token storage

## Success Metrics

### Phase 1 Completion Criteria
1. ✅ OAuth flow completes end-to-end
2. ✅ Tokens stored successfully in KV
3. ✅ Session persists across tool calls
4. ✅ Google Drive tools work with OAuth tokens
5. ✅ MCP client can authenticate via Playground
6. ✅ Local development environment functional
7. ✅ Error handling for expired tokens
8. ✅ Documentation complete and accurate

## Rollout Plan

### Week 1: Foundation
- [ ] Add OAuth dependencies to package.json
- [ ] Create auth module structure
- [ ] Implement basic OAuth flow
- [ ] Set up Google Cloud project

### Week 2: Integration
- [ ] Connect OAuth to MCP handlers
- [ ] Implement session management
- [ ] Add token storage/retrieval
- [ ] Update tool authentication

### Week 3: Testing & Polish
- [ ] Complete local testing
- [ ] Deploy to Cloudflare
- [ ] Playground validation
- [ ] Documentation updates
- [ ] Error handling improvements

## Known Limitations

### Phase 1 Scope
- Single provider (Google) only
- No token refresh automation
- Basic session management
- No multi-tenant support
- No rate limiting

### Future Enhancements (Phase 2+)
- Microsoft OAuth integration
- Automatic token refresh
- Advanced session management
- Multi-tenant architecture
- Rate limiting and quotas
- Audit logging

## References

### Documentation
- [Cloudflare Workers OAuth Provider](https://github.com/cloudflare/workers-oauth-provider)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [MCP Remote Server Guide](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)
- [Model Context Protocol Spec](https://modelcontextprotocol.com/docs/mcp-protocol)

### Example Implementation
- Repository: `google-mcp-remote`
- Key Files:
  - `src/index.ts` - OAuth provider setup
  - `src/auth-handler.ts` - OAuth flow implementation
  - `src/utils/upstream-utils.ts` - Google OAuth helpers
  - `src/utils/workers-oauth-utils.ts` - MCP OAuth utilities

## Appendix: Code Structure

### File Tree After Implementation
```
unified-remote-mcp/
├── src/
│   ├── auth/
│   │   └── oauth-handler.ts    # Main OAuth flow handler
│   ├── utils/
│   │   ├── oauth-utils.ts      # MCP OAuth utilities
│   │   └── upstream-utils.ts   # Google OAuth helpers
│   ├── tools/                  # Existing tools (updated)
│   └── index.ts                 # Updated with OAuth wrapper
├── wrangler.jsonc              # Updated with OAUTH_KV
├── package.json                # Updated dependencies
└── .dev.vars                   # Local OAuth credentials
```

---

*Last Updated: 2025-09-02*
*Status: Ready for Implementation*
*Author: Unified MCP Team*
