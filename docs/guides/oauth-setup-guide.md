# OAuth Setup Guide for Unified MCP Server

## Prerequisites Checklist

Before starting, ensure you have:
- [ ] Google Cloud account with billing enabled
- [ ] Cloudflare account (free tier is fine)
- [ ] Node.js 18+ and npm installed locally
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Access to create OAuth applications in Google Cloud Console

## Step 1: Google Cloud Console Configuration

### 1.1 Create a New Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: `unified-mcp-server`
4. Click "Create" and wait for project creation

### 1.2 Enable Required APIs

Navigate to "APIs & Services" → "Library" and enable:

1. **Google Drive API**
   - Search for "Google Drive API"
   - Click on it and press "Enable"
   - This is the only API needed for our 6 Google Drive tools

### 1.3 Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type (unless you have Google Workspace)
3. Click "Create"

Fill in the required fields:
```
App name: Unified MCP Server
User support email: your-email@example.com
Developer contact: your-email@example.com
```

4. Click "Save and Continue"

5. **Scopes**: Click "Add or Remove Scopes"
   - Add these scopes for Google Drive operations:
   ```
   .../auth/userinfo.email
   .../auth/userinfo.profile
   .../auth/drive
   .../auth/drive.file
   .../auth/drive.readonly
   .../auth/drive.metadata
   ```

6. **Test users**: Add your email address
7. Review and save

### 1.4 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: "Web application"
4. Name: "Unified MCP Server Client"

5. **Authorized JavaScript origins**:
   ```
   https://unified-remote-mcp.YOUR-USERNAME.workers.dev
   http://localhost:8788
   ```

6. **Authorized redirect URIs**:
   ```
   https://unified-remote-mcp.YOUR-USERNAME.workers.dev/callback
   http://localhost:8788/callback
   ```

7. Click "Create"
8. **SAVE YOUR CREDENTIALS**:
   ```
   Client ID: [copy this value]
   Client Secret: [copy this value]
   ```

## Step 2: Cloudflare Setup

### 2.1 Login to Wrangler

```bash
wrangler login
```

This will open your browser for authentication.

### 2.2 Create KV Namespaces

```bash
# Create the OAuth KV namespace
wrangler kv namespace create 'OAUTH_KV'

# Output will look like:
# ✨ Success!
# Add the following to your configuration file:
# kv_namespaces = [
#   { binding = "OAUTH_KV", id = "abc123..." }
# ]
```

Save the ID value - you'll need it for wrangler.jsonc

### 2.3 Set Environment Secrets

```bash
# Set Google OAuth Client ID
wrangler secret put GOOGLE_OAUTH_CLIENT_ID
# Paste your Client ID when prompted

# Set Google OAuth Client Secret
wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
# Paste your Client Secret when prompted

# Generate and set cookie encryption key
wrangler secret put COOKIE_ENCRYPTION_KEY
# Generate a random 32-character string and paste it
```

To generate a random encryption key:
```bash
# On macOS/Linux:
openssl rand -hex 16

# Or use any random string generator
```

## Step 3: Local Development Setup

### 3.1 Create `.dev.vars` File

Create a `.dev.vars` file in your project root:

```env
GOOGLE_OAUTH_CLIENT_ID=your-client-id-here
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret-here
COOKIE_ENCRYPTION_KEY=your-random-32-char-string-here
```

### 3.2 Update `.gitignore`

Ensure `.dev.vars` is in your `.gitignore`:

```gitignore
# Environment variables
.dev.vars
.env
.env.local
```

### 3.3 Install Dependencies

```bash
# Install new OAuth dependencies
npm install @cloudflare/workers-oauth-provider@^0.0.5
npm install googleapis@^148.0.0
npm install hono@^4.7.7
```

## Step 4: Configuration Files

### 4.1 Update `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "unified-remote-mcp",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-10",
  "compatibility_flags": ["nodejs_compat"],
  "migrations": [
    {
      "new_sqlite_classes": ["MyMCP"],
      "tag": "v1"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "class_name": "MyMCP",
        "name": "MCP_OBJECT"
      }
    ]
  },
  "kv_namespaces": [
    {
      "binding": "TOKENS_KV",
      "id": "52bb8ee9b5ee44508cefb7d021862530"
    },
    {
      "binding": "OAUTH_KV",
      "id": "YOUR-OAUTH-KV-ID-HERE"
    }
  ],
  "observability": {
    "enabled": true
  },
  "vars": {
    "ENVIRONMENT": "development"
  }
}
```

### 4.2 Update `package.json` Scripts

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test:oauth": "npx @modelcontextprotocol/inspector@latest",
    "logs": "wrangler tail"
  }
}
```

## Step 5: Testing OAuth Flow

### 5.1 Start Local Development Server

```bash
npm run dev
```

You should see:
```
⎔ Starting local server...
[wrangler] Ready on http://localhost:8788
```

### 5.2 Test with MCP Inspector

In a new terminal:
```bash
npm run test:oauth
```

1. Connect to `http://localhost:8788/sse`
2. Try to use a Google Workspace tool (e.g., gdrive_search_and_read)
3. You should receive an authentication URL
4. Click the URL to complete OAuth flow
5. Return to MCP Inspector and retry the tool

### 5.3 Test OAuth Flow Manually

1. Open browser to: `http://localhost:8788/authorize?client_id=test`
2. You should see the approval dialog
3. Click "Approve"
4. You'll be redirected to Google OAuth
5. Sign in with your Google account
6. Grant permissions
7. You'll be redirected back to the callback

## Step 6: Deploy to Production

### 6.1 Deploy the Worker

```bash
npm run deploy
```

Output:
```
Uploaded unified-remote-mcp (X sec)
Published unified-remote-mcp (X sec)
  https://unified-remote-mcp.YOUR-USERNAME.workers.dev
```

### 6.2 Update Google OAuth Settings

Go back to Google Cloud Console:
1. Update redirect URIs with your actual Worker URL
2. Add your production domain to authorized origins

### 6.3 Test with Cloudflare Playground

1. Go to [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)
2. Enter your MCP server URL:
   ```
   https://unified-remote-mcp.YOUR-USERNAME.workers.dev/sse
   ```
3. Test the OAuth flow

## Step 7: Configure Claude Desktop

### 7.1 Edit Claude Configuration

Find your Claude Desktop config:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### 7.2 Add MCP Server

```json
{
  "mcpServers": {
    "unified-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://unified-remote-mcp.YOUR-USERNAME.workers.dev/sse"
      ]
    }
  }
}
```

### 7.3 Restart Claude Desktop

1. Quit Claude Desktop completely
2. Restart the application
3. The MCP server should appear in available tools

## Troubleshooting

### Common Issues

#### "Invalid redirect_uri" Error
- Ensure callback URL exactly matches Google Console settings
- Check for trailing slashes - they matter!
- Verify both localhost and production URLs are added

#### "Access blocked" Error
- Make sure you've added your email as a test user
- Check that all required APIs are enabled
- Verify OAuth consent screen is configured

#### Tokens Not Persisting
- Check KV namespace is correctly bound in wrangler.jsonc
- Verify OAUTH_KV ID matches the created namespace
- Check Cloudflare dashboard for KV entries

#### "Authentication required" Loop
- Clear browser cookies and try again
- Check encryption key is set correctly
- Verify session generation logic

### Debug Commands

```bash
# View live logs
wrangler tail

# Check KV namespace contents
wrangler kv:key list --namespace-id=YOUR-OAUTH-KV-ID

# Get specific KV value
wrangler kv:key get "session:abc123" --namespace-id=YOUR-OAUTH-KV-ID

# Delete KV entry (for testing)
wrangler kv:key delete "session:abc123" --namespace-id=YOUR-OAUTH-KV-ID
```

### Testing Checklist

- [ ] Local server starts without errors
- [ ] OAuth approval dialog displays
- [ ] Google OAuth redirect works
- [ ] Tokens are stored in KV
- [ ] Tools work with authenticated session
- [ ] Production deployment successful
- [ ] Cloudflare Playground connection works
- [ ] Claude Desktop integration functional

## Security Best Practices

### Production Considerations

1. **Never commit secrets**
   - Use `.dev.vars` for local development
   - Use `wrangler secret` for production

2. **Rotate encryption keys regularly**
   ```bash
   wrangler secret put COOKIE_ENCRYPTION_KEY
   ```

3. **Monitor OAuth usage**
   - Check Google Cloud Console for API usage
   - Set up alerts for unusual activity

4. **Implement rate limiting** (Phase 2)
   - Add Cloudflare Rate Limiting rules
   - Implement per-session request limits

5. **Audit token access**
   - Log token usage in production
   - Monitor for expired token usage

## Next Steps

After completing Phase 1 OAuth setup:

1. **Test all Google Workspace tools** with OAuth tokens:
   - `gdrive_search_and_read`
   - `gdrive_create_content`
   - `gdrive_update_content`
   - `gdrive_manage_folders`
   - `gdrive_share_permissions`
   - `gdrive_export_convert`
2. **Document any issues** in `/docs/troubleshooting/`
3. **Plan Phase 2**: Microsoft OAuth integration
4. **Consider enhancements**:
   - Token refresh automation
   - Multi-tenant support
   - Advanced session management

## Support Resources

- [Cloudflare Workers Discord](https://discord.gg/cloudflaredev)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [MCP Community Forum](https://github.com/modelcontextprotocol/discussions)
- [Project Issues](https://github.com/your-org/unified-remote-mcp/issues)

---

*Last Updated: 2025-09-02*
*Version: 1.0.0*
*Status: Phase 1 Setup Guide*
