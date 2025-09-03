<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Implementing Google OAuth to use Google API in Cloudflare Workers remote mcp

To implement **Google OAuth** for Google API access in a Cloudflare Workers remote MCP server, deploy a Cloudflare Worker using OAuth client credentials from Google Cloud, then leverage the `workers-oauth-provider` library to handle authentication and authorization for remote MCP connections.[^1][^2]

## Step-by-Step Implementation

### 1. Set Up Google OAuth App

- Go to Google Cloud Console and create an OAuth 2.0 client for your application.[^2][^1]
- Provide authorize and callback URLs that point to your Cloudflare Worker (e.g., `https://mcp-google-oauth.<your-subdomain>.workers.dev` and `https://mcp-google-oauth.<your-subdomain>.workers.dev/callback`).[^1]


### 2. Store Secrets in Cloudflare

- Use `wrangler` CLI or the Cloudflare dashboard to securely store:
    - `GOOGLE_CLIENT_ID`
    - `GOOGLE_CLIENT_SECRET`
    - `COOKIE_ENCRYPTION_KEY`
    - Optionally, a `HOSTED_DOMAIN` for restricting Google account domains.[^1]


### 3. Deploy MCP Server with Google OAuth

- Clone a ready-made template or MCP server reference implementation using Google OAuth:
    - Install dependencies with `npm install`.
    - Set up any needed Cloudflare KV namespaces for persistent token/session storage (`wrangler kv:namespace create "OAUTH_KV"`).[^2][^1]
    - Deploy the worker: `wrangler deploy`.[^1]


### 4. Integrate OAuth Flows

- Use the `workers-oauth-provider` Node module or a similar pure JS solution for OAuth 2.0 in the Worker context (no Node.js SDK support, so use browser-style techniques).[^3][^2][^1]
- Redirect users to the Google OAuth login, handle the callback, exchange the authorization code for a token, and manage sessions via encrypted cookies.[^2][^1]
- For MCP clients, require their requests to authenticate using Google OAuth, with permission/control handled inside the Worker.[^4]


### 5. Use Google API With Access Token

- After authenticating, use the returned OAuth token to authorize requests to Google APIs:
    - Example fetch to Google Cloud Storage:

```js
const res = await fetch('https://storage.googleapis.com/storage/v1/b/MY_BUCKET/o/MY_OBJECT.png?alt=media', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'image/png',
    'Accept': 'image/png',
  },
});
```

    - Adjust endpoints and scopes for other APIs (e.g., Pub/Sub, Sheets).[^5][^6][^3]


## References and Templates

- Ready-to-deploy MCP server with Google OAuth: See the LobeHub repo for MCP Model Context Protocol , and MCP Market reference implementation.[^2][^1]
- JS Auth libraries for Cloudflare: See `cloudflare-workers-and-google-oauth` for service account authentication and token fetching.[^6][^3]
- Detailed worker OAuth model: Cloudflare documentation covers OAuth in MCP, including authentication callbacks and token management.[^4][^2]


## Final Notes

- Cloudflare Workers run in a serverless, non-Node environment; use only browser-compatible libraries for OAuth flows.[^3][^5][^6]
- Persistent state (tokens, sessions) should be managed using Cloudflare KV or Durable Objects for security.[^2]
- Use the OAuth token for all Google API requests, handling refresh logic as needed.[^5]

This approach offers a robust, scalable way to authorize remote MCP tooling and securely interface with Google APIs via Cloudflare Workers.[^3][^1][^2]
<span style="display:none">[^10][^7][^8][^9]</span>

<div style="text-align: center">⁂</div>

[^1]: https://lobehub.com/mcp/emaad-brainwonders-remote-mcp-server-googleauth

[^2]: https://mcpmarket.com/server/google-oauth

[^3]: https://github.com/Schachte/cloudflare-google-auth

[^4]: https://developers.cloudflare.com/agents/model-context-protocol/authorization/

[^5]: https://hookdeck.com/blog/how-to-call-google-cloud-apis-from-cloudflare-workers

[^6]: https://www.reddit.com/r/googlecloud/comments/v100x6/accessing_google_cloud_apis_from_under_cloudflare/

[^7]: https://jilles.me/cloudflare-workers-sveltekit-betterauth-custom-domain-google-oauth-otp-email-securing-your-application/

[^8]: https://www.reddit.com/r/CloudFlare/comments/169u6b1/google_oauth_with_workers/

[^9]: https://community.auth0.com/t/cloudflare-worker-implementation-for-an-oauth2-proxy/100145

[^10]: https://ryan-schachte.com/blog/oauth_cloudflare_workers/

