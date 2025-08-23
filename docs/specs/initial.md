# UnifiedMCP → Cloudflare Workers Spec

## **Objective**
Build a HTTP streamable transport MCP from scratch using Cloudflare Workers deploy as remote MCP server with multi-user OAuth support. Get a "Hello World" remote MCP server running on Cloudflare with OAuth, connecting to Claude Desktop successfully.


## **Phase 1: Foundation First (Session 1)**
Deploy bare-bones authenticated MCP server with **zero functionality** - just prove the plumbing works.

## **Tech Stack**
- **Framework**: Cloudflare Agents SDK 
- **Language**: TypeScript
- **Auth**: Cloudflare OAuth Provider (following their guide exactly)
- **Transport**: Streamable HTTP
- **Tools**: ONE dummy tool (`ping` - returns "pong")

## **Following Cloudflare's Recipe**
```bash
# Exact steps from their guide:
1. Deploy example MCP server (auth-less)  
2. Test connection with Claude Desktop
3. Add OAuth authentication  
4. Test auth flow
5. Confirm everything works
```

## **Success Criteria Phase 1**
- ✅ MCP server deployed to `your-name.workers.dev`
- ✅ Claude Desktop connects via `mcp-remote`
- ✅ OAuth login flow works
- ✅ Can call ONE dummy tool successfully
- ✅ Multi-user ready (wife can log in separately)

## **Phase 2: Add Real Tools (Later)**
Only AFTER Phase 1 works perfectly:
- Replace dummy tool with 6 Google Workspace tools & 6 Microsoft 365 tools
- Add Google OAuth (second auth layer)
- Add token persistence in Cloudflare KV
- Multi-provider token management

## **Tech Stack**
- **Framework**: Cloudflare Agents SDK (`workers-mcp`)
- **Language**: TypeScript 
- **Auth**: Three-Layer Auth Architecture Cloudflare OAuth Provider (server access) + Google OAuth (google API access) + Microsoft Auth (Microsoft Graph API Access)
- **Storage**: Cloudflare KV (token persistence)
- **Transport**: Streamable HTTP
- **Payments**: Stripe + Cloudflare Workers

```typescript
// Your consolidated 12-tool empire:

// Google Workspace Tools (6)
@tool("gdrive_search_and_read")
@tool("gdrive_create_content") 
@tool("gdrive_update_content")
@tool("gdrive_manage_folders")
@tool("gdrive_share_permissions")
@tool("gdrive_export_convert")

// Microsoft 365 Tools (6) 
@tool("m365_email_operations")
@tool("m365_calendar_management")
@tool("m365_onedrive_files")
@tool("m365_contacts_people")
@tool("m365_teams_collaboration")
@tool("m365_office_documents")
```
## User Flow

1. Sign up for UnifiedMCP → Cloudflare OAuth (pay you)
2. Connect Google Drive → Google OAuth (optional)
3. Connect Microsoft 365 → Microsoft Graph OAuth (optional)

## Storage Recommendation:
- Cloudflare D1 (SQLite)

## Minimum Viable Product Stack:

    ```typescript
    // UnifiedMCP Architecture
    Cloudflare Workers (compute)
    ├── Cloudflare D1 (user accounts + billing)
    ├── Cloudflare KV (encrypted OAuth tokens)  
    ├── Stripe (payments + subscriptions)
    ├── Cloudflare OAuth (UnifiedMCP account auth)
    └── Google/Microsoft OAuth (service connections)
    ```
    ```typescript
    // Stripe Integration Details
    - Webhook handlers for subscription events
    - Payment flow integration 
    - Subscription tier enforcement
    - Usage limits per tier
    ```
 ## Error Handling & Security 
    1. Token refresh logic for Google/Microsoft
    2. Rate limiting strategy
    3. Error boundaries for failed OAuth
    4. Token encryption/decryption methods

## Testing Strategy

    ```bash
    - Unit tests for each tool
    - Integration tests for OAuth flows
    - Load testing for Cloudflare Workers
    - End-to-end testing with Claude Desktop
    ```
## Deployment Pipeline
```yaml
# CI/CD considerations:
- GitHub Actions for automated deployment
- Environment management (dev/staging/prod)
- Secret management for API keys
- Monitoring and observability
```
## Things to decide
- Exact Google APIs to integrate (Drive, Docs, Sheets, Gmail?)
- Microsoft Graph API endpoints needed
- Token storage encryption strategy
- Multi-tenant data isolation

## **Saturday Timeline (Phase 1 Only)**
- **60 min**: Follow Cloudflare guide step-by-step
- **30 min**: Deploy and test basic connection
- **30 min**: Add OAuth and test auth flow

**Focus**: Get the infrastructure right first, worry about Google Workspace & Other tools later.

