---
url: https://developers.cloudflare.com/agents/guides/remote-mcp-server/
scraped_date: 2025-08-21
domain: developers.cloudflare.com
title: Build a Remote MCP Server - Cloudflare Agents
source: Official Cloudflare Documentation
---

# Build a Remote MCP Server

## Overview

This guide demonstrates how to deploy a remote Model Context Protocol (MCP) server on Cloudflare with two authentication options:
- Unauthenticated server (public access)
- Authenticated server with user authorization

## Deploy Your First MCP Server

### Setup via CLI

You can create a new MCP server using npm, yarn, or pnpm:

```bash
# Using npm
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless

# Using yarn
yarn create cloudflare my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless

# Using pnpm
pnpm create cloudflare@latest my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
```

### Local Development

1. Navigate to the project directory:
```bash
cd my-mcp-server
```

2. Start the development server:
```bash
npm start
```

The MCP server will run at `http://localhost:8788/sse`.

### Deployment

Deploy to Cloudflare using Wrangler:
```bash
npx wrangler@latest deploy
```

## Connecting to MCP Clients

### Local Proxy Connection

Use the `mcp-remote` local proxy to connect clients like Claude Desktop:

Update Claude Desktop configuration:
```json
{
  "mcpServers": {
    "math": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-name.your-account.workers.dev/sse"
      ]
    }
  }
}
```

## Adding Authentication

### OAuth Setup with GitHub

1. Create two GitHub OAuth Apps:
   - One for local development
   - One for production

2. Local Development OAuth App Configuration:
   - Application name: `My MCP Server (local)`
   - Homepage URL: `http://localhost:8787`
   - Authorization callback URL: `http://localhost:8787/oauth/callback`

3. Production OAuth App Configuration:
   - Application name: `My MCP Server`
   - Homepage URL: `https://your-worker-name.your-account.workers.dev`
   - Authorization callback URL: `https://your-worker-name.your-account.workers.dev/oauth/callback`

### Environment Variables

Set up environment variables for local development:

Create `.dev.vars` file:
```env
GITHUB_CLIENT_ID=your_local_client_id
GITHUB_CLIENT_SECRET=your_local_client_secret
```

For production, use Wrangler secrets:
```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

### Authenticated Server Template

Use the authenticated template:
```bash
npm create cloudflare@latest -- my-mcp-server --template=cloudflare/ai/demos/remote-mcp-auth
```

## MCP Server Architecture

### Key Components

1. **Transport Layer**: Server-Sent Events (SSE) endpoint at `/sse`
2. **Authentication**: OAuth integration with multiple providers
3. **Tool Router**: MCP tool handling and routing
4. **Authorization**: User-based access control

### OAuth Provider Setup

```typescript
import GitHubHandler from "./github-handler";

export default new OAuthProvider({
  apiRoute: "/sse",
  apiHandler: MyMCP.Router,
  defaultHandler: GitHubHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

## Supported OAuth Providers

- GitHub
- Google
- Slack
- Auth0
- WorkOS

## Testing and Development

### Local MCP Inspector

Access the local MCP inspector at `http://localhost:8788` during development to test your server's functionality.

### Claude Desktop Integration

1. Configure Claude Desktop with your MCP server URL
2. Restart Claude Desktop
3. Verify tools appear in the tools panel (🔨 icon)

## Next Steps

1. Add custom tools to your MCP server
2. Implement granular authorization logic
3. Customize authentication mechanisms
4. Deploy to production with proper monitoring

## Key Benefits

- **Scalable**: Cloudflare Workers provide global edge deployment
- **Secure**: Built-in OAuth integration with multiple providers
- **Flexible**: Support for both authenticated and unauthenticated servers
- **Easy Deployment**: Simple CLI-based setup and deployment

## Resources

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)