---
title: "Phase 1 OAuth Implementation PRP"
description: "Product Requirement Prompt for implementing OAuth authentication in UnifiedMCP using official Cloudflare patterns"
category: "Implementation"
subcategory: "Authentication"
product_line: "UnifiedMCP"
audience: "AI Development Agent"
status: "Ready for Implementation"
author: "AOJDevStudio"
created_date: "2025-09-02"
last_updated: "2025-09-02"
tags:
  - oauth
  - authentication
  - cloudflare-workers
  - mcp-server
  - phase-1
---

# Phase 1 OAuth Implementation PRP

## Goal

**Feature Goal**: Migrate UnifiedMCP from custom OAuth implementation to official Cloudflare Workers OAuth Provider pattern, enabling secure, standards-compliant authentication for Google Workspace tools through the MCP protocol.

**Deliverable**: Production-ready OAuth authentication system using `@cloudflare/workers-oauth-provider` that integrates seamlessly with existing Google Workspace tools and Claude Desktop via mcp-remote proxy.

**Success Definition**: 
- OAuth flow completes end-to-end using official Cloudflare pattern
- All 6 Google Workspace tools work with OAuth tokens 
- MCP client (Claude Desktop) can authenticate via Playground and mcp-remote
- Token refresh handles expiration automatically
- Implementation follows Cloudflare best practices exactly

## Why

**Business Justification**:
- **Standards Compliance**: Current custom implementation doesn't follow Cloudflare's official OAuth patterns, creating maintenance burden
- **Future-Proofing**: Official OAuth Provider handles security updates, token management, and protocol changes automatically
- **Reliability**: Cloudflare-managed OAuth implementation reduces bugs and security vulnerabilities
- **Scalability**: Official pattern supports multiple OAuth providers (Microsoft, GitHub) for Phase 2 expansion

**Risk Mitigation**:
- Current custom OAuth implementation requires ongoing maintenance for security patches
- Non-standard approach makes debugging and extending authentication complex
- Manual token management increases risk of token exposure or improper handling

## What

**Description**: Replace existing custom OAuth implementation (GoogleOAuthHandler, TokenManager) with Cloudflare's official `@cloudflare/workers-oauth-provider` wrapper pattern that automatically handles OAuth endpoints, token storage, and user authorization.

**User Stories**:
- As a Claude Desktop user, I want seamless OAuth login to access my Google Drive through UnifiedMCP tools
- As a developer, I want OAuth implementation that follows Cloudflare best practices and requires minimal maintenance
- As a system administrator, I want secure token handling with automatic refresh and proper encryption

**Success Criteria**:
- Migration from custom OAuth to official pattern completed without data loss
- All existing Google Drive tools (`gdrive_search_and_read`, `gdrive_create_content`, etc.) work with new auth system
- OAuth flow completion time under 30 seconds from authorization to tool access
- Token refresh occurs automatically without user intervention
- Claude Desktop connects successfully via mcp-remote proxy

## Context

```yaml
documentation:
  - source: "ai-docs/cloudflare-remote-mcp-server-guide.md"
    why: "Official Cloudflare MCP OAuth implementation patterns and architecture"
    sections: ["OAuth Provider Setup", "Supported OAuth Providers", "MCP Server Architecture"]
    
  - source: "https://github.com/cloudflare/workers-oauth-provider"
    why: "Complete API documentation and usage patterns for official OAuth Provider library"
    sections: ["Installation", "Configuration", "OAuth Provider Options", "Token Management"]
    
  - source: "https://developers.cloudflare.com/agents/guides/remote-mcp-server/"
    why: "Step-by-step guide for building authenticated remote MCP servers"
    sections: ["Adding Authentication", "OAuth Setup with GitHub", "Environment Variables"]
    
  - source: "https://github.com/cloudflare/ai/blob/main/demos/remote-mcp-github-oauth/README.md"
    why: "Reference implementation showing official OAuth Provider pattern usage"
    sections: ["OAuth Configuration", "Handler Setup", "Token Exchange"]

existing_code:
  - file: "src/index.ts"
    purpose: "Current MCP server with custom OAuth endpoints (/authorize, /oauth/callback)"
    lines: "390-498 (OAuth handlers), 500-536 (routing)"
    
  - file: "src/auth/google-oauth.ts" 
    purpose: "Custom GoogleOAuthHandler - TO BE REPLACED with OAuth Provider"
    lines: "8-159 (complete OAuth flow implementation)"
    
  - file: "src/auth/token-manager.ts"
    purpose: "Custom TokenManager - TO BE REPLACED with OAuth Provider storage"
    lines: "9-176 (token storage and refresh logic)"
    
  - file: "src/types/auth.ts"
    purpose: "Authentication types - some may need updating for OAuth Provider"
    lines: "5-41 (GoogleTokens, AuthenticatedUser, etc.)"
    
  - file: "package.json"
    purpose: "Dependencies - needs @cloudflare/workers-oauth-provider added"
    lines: "14-18 (dependencies section)"
    
  - file: "wrangler.jsonc" 
    purpose: "Cloudflare configuration with TOKENS_KV - needs OAUTH_KV added"
    lines: "KV namespaces configuration"

gotchas:
  - "BREAKING CHANGE: OAuth Provider pattern requires complete rewrite of auth endpoints"
  - "KV Storage Migration: Existing TOKENS_KV may need data migration to new OAuth Provider format"  
  - "User ID Changes: OAuth Provider may generate different user identifiers than current custom system"
  - "Environment Variables: Requires OAUTH_KV namespace and proper secret management"
  - "Token Format: OAuth Provider uses different token storage schema than current TokenManager"
  - "Endpoint Changes: /authorize and /oauth/callback will be handled by OAuth Provider automatically"
  - "Handler Registration: MCP tools need to be registered within OAuth Provider wrapper"
  - "Google Scopes: Must configure proper Google OAuth scopes for Drive API access"

current_state: |
  Custom OAuth implementation with:
  - GoogleOAuthHandler for auth flow
  - TokenManager for KV storage 
  - Custom /authorize and /oauth/callback endpoints
  - 6 Google Workspace tools with manual auth checks
  - Working SSE transport at /sse endpoint
  - Manual token refresh logic
  
  Ready for migration to official OAuth Provider pattern.

dependencies:
  - "@cloudflare/workers-oauth-provider": "^0.0.5"
  - "agents": "^0.0.109" 
  - "@modelcontextprotocol/sdk": "1.17.1"
  - "zod": "^3.25.67"

environment_variables:
  - GOOGLE_CLIENT_ID: "Google OAuth2 client ID"
  - GOOGLE_CLIENT_SECRET: "Google OAuth2 client secret" 
  - OAUTH_KV: "KV namespace binding for OAuth Provider storage"
```

## Implementation Blueprint

### Phase 1: OAuth Provider Migration Setup
**Description**: Install OAuth Provider library and create basic wrapper structure

**Tasks**:
  - title: "Add OAuth Provider dependency and update package.json"
    files: ["package.json"]
    details: "Install @cloudflare/workers-oauth-provider@^0.0.5 dependency. Update scripts if needed for development/deployment."
    
  - title: "Create OAUTH_KV namespace and update wrangler.jsonc"
    files: ["wrangler.jsonc"]
    details: "Run `wrangler kv:namespace create OAUTH_KV` and add binding to wrangler.jsonc alongside existing TOKENS_KV."
    
  - title: "Create Google OAuth handler following official pattern"
    files: ["src/auth/google-oauth-provider.ts"]
    details: "Implement Google OAuth handler using OAuth Provider library patterns. Reference GitHub example but adapt for Google OAuth endpoints."

### Phase 2: MCP Server Integration  
**Description**: Wrap existing MCP server with OAuth Provider

**Tasks**:
  - title: "Refactor main entry point to use OAuth Provider wrapper"
    files: ["src/index.ts"]
    details: "Replace current default export with new OAuthProvider({ apiRoute: '/sse', apiHandler: MyMCP.Router, defaultHandler: GoogleOAuthHandler })"
    
  - title: "Update MCP server to receive authenticated user context"
    files: ["src/index.ts"]
    details: "Modify MyMCP class to receive user context from OAuth Provider. Update getUserId method to use provider-supplied user data."
    
  - title: "Remove custom OAuth endpoints and handlers"
    files: ["src/index.ts"]  
    details: "Delete handleAuthorize and handleOAuthCallback functions (lines 390-498). Remove OAuth routing logic as OAuth Provider handles this."

### Phase 3: Tool Authentication Integration
**Description**: Update tools to work with OAuth Provider authentication

**Tasks**:
  - title: "Update tool authentication to use OAuth Provider user context"
    files: ["src/index.ts"]
    details: "Modify each Google Drive tool (gdrive_search_and_read, etc.) to extract user info from OAuth Provider context instead of manual token checking."
    
  - title: "Configure Google OAuth scopes in OAuth Provider"
    files: ["src/auth/google-oauth-provider.ts"]
    details: "Set scopes: ['https://www.googleapis.com/auth/drive', 'profile', 'email'] in OAuth Provider configuration for Google Drive API access."
    
  - title: "Update GoogleApiClient to work with OAuth Provider tokens"
    files: ["src/lib/google-client.ts", "src/lib/google-drive-api.ts"]
    details: "Modify Google API client to receive tokens from OAuth Provider instead of custom TokenManager. Update token refresh logic."

### Phase 4: Data Migration and Cleanup
**Description**: Migrate existing tokens and clean up deprecated code  

**Tasks**:
  - title: "Create token migration script for existing users"
    files: ["scripts/migrate-tokens.ts"]
    details: "Script to migrate existing TOKENS_KV data to OAuth Provider format. Handle user ID mapping and token format conversion."
    
  - title: "Remove deprecated authentication modules"
    files: ["src/auth/google-oauth.ts", "src/auth/token-manager.ts"]
    details: "Delete custom OAuth implementation files after successful migration. Update imports throughout codebase."
    
  - title: "Update TypeScript types for OAuth Provider integration"
    files: ["src/types/auth.ts"] 
    details: "Remove custom types like GoogleTokens, AuthState. Add types for OAuth Provider user context and token structure."

## Validation

### Level 1: Syntax and Dependencies
```bash
# Install new dependencies
npm install @cloudflare/workers-oauth-provider@^0.0.5

# Create OAuth KV namespace
wrangler kv:namespace create OAUTH_KV

# TypeScript compilation check
npm run type-check
```

### Level 2: Local Development Testing
```bash
# Start development server
npm run dev

# Expected: Server runs on http://localhost:8788/sse
# Test: OAuth Provider endpoints automatically available
# Expected: /authorize and /token endpoints respond

# Test OAuth flow locally
# Navigate to http://localhost:8788/authorize
# Expected: Redirect to Google OAuth consent screen
```

### Level 3: Integration Testing
```bash
# Deploy to Cloudflare staging
npx wrangler deploy

# Test with MCP Inspector
# Connect to https://worker-name.account.workers.dev/sse
# Expected: OAuth Provider handles authentication automatically

# Test each Google Drive tool
# Expected: All 6 tools work with OAuth Provider authentication
```

### Level 4: End-to-End Production Testing
```bash
# Configure Claude Desktop with mcp-remote
# Update claude_desktop_config.json with production URL

# Complete OAuth flow via Claude Desktop
# Expected: OAuth consent, authorization, and token storage complete

# Test Google Drive tools via Claude Desktop
# Expected: gdrive_search_and_read, gdrive_create_content, etc. all functional

# Test token refresh after expiration
# Expected: Automatic token refresh without user intervention
```

## Additional Context

### Security Considerations
- OAuth Provider handles token encryption automatically using Cloudflare's security standards
- HTTPS enforcement built into OAuth Provider for production environments  
- State parameter validation and CSRF protection included in OAuth Provider
- Token storage limited to KV with automatic TTL management

### Migration Strategy
1. **Parallel Testing**: Run OAuth Provider alongside existing system during development
2. **Gradual Rollout**: Test with limited users before full migration
3. **Rollback Plan**: Keep existing auth system until OAuth Provider fully validated
4. **Data Preservation**: Migrate existing user tokens to prevent re-authentication

### Performance Considerations  
- OAuth Provider adds minimal overhead compared to custom implementation
- Token refresh handled asynchronously by OAuth Provider
- KV read/write operations optimized for global edge deployment
- SSE transport performance unaffected by authentication layer

### Monitoring and Observability
- OAuth Provider provides built-in logging for authentication events
- Monitor KV usage for token storage consumption
- Track OAuth flow completion rates and error patterns
- Alert on token refresh failures or authentication errors

---

**Confidence Score**: 9/10 for one-pass implementation success

**Implementation Estimate**: 12-16 hours (2-3 development days)

**Risk Level**: Medium (architectural change but well-documented pattern)

**Dependencies**: Google Cloud Console OAuth app configuration, Cloudflare KV namespace setup