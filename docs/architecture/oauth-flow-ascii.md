# OAuth Architecture Flow - ASCII Diagram

## Current Implementation Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           UNIFIED REMOTE MCP SERVER                            │
│                          (Cloudflare Workers)                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              REQUEST ROUTER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ /authorize  │  │ /callback   │  │    /sse     │  │    /mcp     │          │
│  │             │  │             │  │             │  │             │          │
│  │ OAuth Start │  │ OAuth End   │  │ MCP SSE     │  │ MCP HTTP    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            MCP AGENT (MyMCP)                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        AUTHENTICATION LAYER                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │ GoogleOAuth     │  │ TokenManager    │  │ GoogleApiClient │        │   │
│  │  │ Handler         │  │                 │  │                 │        │   │
│  │  │                 │  │ • Store tokens  │  │ • Auth requests │        │   │
│  │  │ • Generate URLs │  │ • Refresh logic │  │ • User profile  │        │   │
│  │  │ • Exchange code │  │ • Encrypt/Decrypt│  │ • Test connection│       │   │
│  │  │ • Get user info │  │ • State mgmt    │  │                 │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                       │
│                                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           GOOGLE DRIVE TOOLS                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │ Search &    │  │ Create      │  │ Update      │  │ Manage      │   │   │
│  │  │ Read        │  │ Content     │  │ Content     │  │ Folders     │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  │  ┌─────────────┐  ┌─────────────┐                                    │   │
│  │  │ Share       │  │ Export &    │                                    │   │
│  │  │ Permissions │  │ Convert     │                                    │   │
│  │  └─────────────┘  └─────────────┘                                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUDFLARE KV STORAGE                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                            TOKEN STORAGE                               │   │
│  │  Key: google_tokens:{userId}                                           │   │
│  │  Value: {                                                              │   │
│  │    access_token: "ya29.a0...",                                         │   │
│  │    refresh_token: "1//0...",                                           │   │
│  │    expires_at: 1234567890,                                             │   │
│  │    scope: "openid email profile",                                      │   │
│  │    token_type: "Bearer"                                                │   │
│  │  }                                                                     │   │
│  │  TTL: 30 days                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           STATE STORAGE                                │   │
│  │  Key: oauth_state:{state}                                              │   │
│  │  Value: {                                                              │   │
│  │    state: "abc123...",                                                 │   │
│  │    redirect_uri: "http://localhost:8788/oauth/callback",               │   │
│  │    created_at: 1234567890                                              │   │
│  │  }                                                                     │   │
│  │  TTL: 10 minutes                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## OAuth Flow Sequence

```
1. USER CONNECTS TO MCP SERVER
   ┌─────────────┐    SSE Connection    ┌─────────────┐
   │ MCP Client  │ ──────────────────► │ MCP Server  │
   │ (Claude)    │                      │             │
   └─────────────┘                      └─────────────┘

2. AUTHENTICATION REQUIRED
   ┌─────────────┐    Auth Required     ┌─────────────┐
   │ MCP Client  │ ◄────────────────── │ MCP Server  │
   │ (Claude)    │                      │             │
   └─────────────┘                      └─────────────┘

3. INITIATE OAUTH FLOW
   ┌─────────────┐    GET /authorize    ┌─────────────┐
   │    User     │ ──────────────────► │ MCP Server  │
   │ (Browser)   │                      │             │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Store State      ┌─────────────┐
   │ MCP Server  │ ──────────────────► │ KV Storage  │
   │             │                      │             │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Redirect to      ┌─────────────┐
   │ MCP Server  │ ──────────────────► │   Google    │
   │             │    Google OAuth     │   OAuth2    │
   └─────────────┘                      └─────────────┘

4. USER GRANTS PERMISSIONS
   ┌─────────────┐    Consent Screen   ┌─────────────┐
   │    User     │ ◄────────────────── │   Google    │
   │ (Browser)   │                      │   OAuth2    │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Authorization    ┌─────────────┐
   │    User     │ ──────────────────► │   Google    │
   │ (Browser)   │      Code           │   OAuth2    │
   └─────────────┘                      └─────────────┘

5. OAUTH CALLBACK
   ┌─────────────┐    Redirect with    ┌─────────────┐
   │   Google    │ ──────────────────► │ MCP Server  │
   │   OAuth2    │    code & state     │             │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Validate State   ┌─────────────┐
   │ MCP Server  │ ──────────────────► │ KV Storage  │
   │             │                      │             │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Exchange Code    ┌─────────────┐
   │ MCP Server  │ ──────────────────► │   Google    │
   │             │    for Tokens       │   OAuth2    │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Get User Info    ┌─────────────┐
   │ MCP Server  │ ──────────────────► │   Google    │
   │             │                      │   OAuth2    │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Store Tokens     ┌─────────────┐
   │ MCP Server  │ ──────────────────► │ KV Storage  │
   │             │                      │             │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Success Page     ┌─────────────┐
   │ MCP Server  │ ──────────────────► │    User     │
   │             │                      │ (Browser)   │
   └─────────────┘                      └─────────────┘

6. TOOL EXECUTION
   ┌─────────────┐    Use Tool         ┌─────────────┐
   │ MCP Client  │ ──────────────────► │ MCP Server  │
   │ (Claude)    │                      │             │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Get Tokens       ┌─────────────┐
   │ MCP Server  │ ──────────────────► │ KV Storage  │
   │             │                      │             │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    API Call         ┌─────────────┐
   │ MCP Server  │ ──────────────────► │   Google    │
   │             │   (Authenticated)   │   Drive     │
   └─────────────┘                      └─────────────┘
                                        │
                                        ▼
   ┌─────────────┐    Tool Result      ┌─────────────┐
   │ MCP Server  │ ──────────────────► │ MCP Client  │
   │             │                      │ (Claude)    │
   └─────────────┘                      └─────────────┘
```

## Key Implementation Details

### Authentication Components
- **GoogleOAuthHandler**: Manages OAuth flow, token exchange, user info
- **TokenManager**: Handles secure token storage, refresh logic, state management
- **GoogleApiClient**: Makes authenticated API requests
- **GoogleDriveAPI**: Implements 6 Google Drive tools

### Security Features
- CSRF protection via state parameter
- Token encryption (base64 - should be improved)
- Automatic token refresh with 5-minute buffer
- 30-day token TTL, 10-minute state TTL

### Storage Schema
- **Tokens**: `google_tokens:{userId}` → encrypted token data
- **State**: `oauth_state:{state}` → OAuth flow state

### Current OAuth Scopes
- `openid` - OpenID Connect
- `email` - User email address  
- `profile` - Basic profile information

### Endpoints
- `GET /authorize` - Start OAuth flow
- `GET /oauth/callback` - Handle OAuth callback
- `GET /sse` - MCP Server-Sent Events
- `POST /mcp` - MCP HTTP protocol
- `GET /health` - Health check
