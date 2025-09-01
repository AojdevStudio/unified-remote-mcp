# Google OAuth2 Implementation Guide for Cloudflare Workers

## Critical Implementation Details for UnifiedMCP

### 1. OAuth2 Flow Endpoints & Parameters

#### Authorization Endpoint
```
URL: https://accounts.google.com/o/oauth2/v2/auth
```

**Required Query Parameters:**
```typescript
{
  client_id: string,              // From Google Cloud Console
  redirect_uri: string,            // Must match registered URI exactly
  response_type: 'code',           // Always 'code' for server flow
  scope: string,                   // Space-separated scopes
  access_type: 'offline',          // CRITICAL: Required for refresh_token
  prompt: 'consent',               // Forces refresh_token on re-auth
  state: string,                   // CSRF protection token
  code_challenge: string,          // PKCE challenge (optional but recommended)
  code_challenge_method: 'S256'    // PKCE method
}
```

#### Token Exchange Endpoint
```
URL: https://oauth2.googleapis.com/token
```

**Required POST Body (URL-encoded):**
```typescript
{
  code: string,                    // Authorization code from callback
  client_id: string,               // From Google Cloud Console
  client_secret: string,           // From Google Cloud Console
  redirect_uri: string,            // Must match exactly
  grant_type: 'authorization_code',
  code_verifier: string            // PKCE verifier (if used)
}
```

**Response:**
```typescript
{
  access_token: string,            // Bearer token for API calls
  refresh_token: string,           // Only on first auth with offline access
  expires_in: number,              // Seconds until expiration (usually 3600)
  token_type: 'Bearer',
  scope: string                    // Granted scopes
}
```

### 2. Token Refresh Endpoint

**URL:** `https://oauth2.googleapis.com/token`

**Required POST Body:**
```typescript
{
  refresh_token: string,
  client_id: string,
  client_secret: string,
  grant_type: 'refresh_token'
}
```

### 3. Google Drive API Scopes

```typescript
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',          // Files created/opened by app
  'https://www.googleapis.com/auth/drive.readonly',      // Read all files
  'https://www.googleapis.com/auth/drive.metadata.readonly' // File metadata
];

// Optional but recommended
const OPTIONAL_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',      // User identification
  'https://www.googleapis.com/auth/userinfo.profile'     // User profile info
];
```

### 4. Critical Gotchas & Solutions

#### Gotcha 1: refresh_token Only Returned Once
**Problem:** Google only returns refresh_token on first authorization
**Solution:** 
- Always include `access_type=offline` 
- Include `prompt=consent` to force new refresh_token
- Store refresh_token immediately and permanently

#### Gotcha 2: Token Format Validation
**Pattern:** Google access tokens always start with `ya29.`
```typescript
function isValidGoogleToken(token: string): boolean {
  return token.startsWith('ya29.');
}
```

#### Gotcha 3: Redirect URI Must Match Exactly
**Problem:** Even trailing slashes cause mismatch errors
**Solution:** Store exact URI in environment variable:
```typescript
// ✅ Correct
GOOGLE_REDIRECT_URI=https://your-worker.workers.dev/oauth/callback

// ❌ Will fail if registered without trailing slash
GOOGLE_REDIRECT_URI=https://your-worker.workers.dev/oauth/callback/
```

#### Gotcha 4: Cloudflare Workers Environment Variables
**Problem:** Environment variables not available at module scope
**Solution:** Access env variables inside request handlers:
```typescript
// ❌ Wrong - Module scope
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// ✅ Correct - Inside handler
export default {
  async fetch(request: Request, env: Env) {
    const CLIENT_ID = env.GOOGLE_CLIENT_ID;
  }
}
```

### 5. Cloudflare KV Token Storage Pattern

```typescript
interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;      // Unix timestamp
  scope: string;
  user_email?: string;     // Optional user identifier
}

// Store tokens with automatic expiration
async function storeTokens(sessionId: string, tokens: StoredTokens, env: Env) {
  const expirationTtl = 30 * 24 * 60 * 60; // 30 days
  
  await env.USER_TOKENS.put(
    `session:${sessionId}`,
    JSON.stringify(tokens),
    { expirationTtl }
  );
}

// Retrieve and check expiration
async function getValidToken(sessionId: string, env: Env): Promise<string> {
  const stored = await env.USER_TOKENS.get(`session:${sessionId}`);
  if (!stored) throw new Error('No stored tokens');
  
  const tokens: StoredTokens = JSON.parse(stored);
  
  // Check if expired (with 5-minute buffer)
  if (Date.now() > (tokens.expires_at - 300000)) {
    // Refresh the token
    const newTokens = await refreshAccessToken(tokens.refresh_token, env);
    await storeTokens(sessionId, newTokens, env);
    return newTokens.access_token;
  }
  
  return tokens.access_token;
}
```

### 6. PKCE Implementation (Recommended)

```typescript
// Generate PKCE parameters
function generatePKCE() {
  const verifier = crypto.randomUUID() + crypto.randomUUID(); // 72 chars
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return { verifier, challenge };
}
```

### 7. State Parameter for CSRF Protection

```typescript
// Generate and store state
function generateState(sessionId: string): string {
  const state = crypto.randomUUID();
  // Store in KV with short TTL
  env.OAUTH_STATES.put(state, sessionId, { expirationTtl: 600 }); // 10 min
  return state;
}

// Validate state in callback
async function validateState(state: string, env: Env): Promise<string> {
  const sessionId = await env.OAUTH_STATES.get(state);
  if (!sessionId) throw new Error('Invalid state parameter');
  
  // Delete after use
  await env.OAUTH_STATES.delete(state);
  return sessionId;
}
```

### 8. Error Handling Patterns

```typescript
// OAuth-specific error types
class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

// Common OAuth errors
const OAUTH_ERRORS = {
  INVALID_GRANT: new OAuthError('Invalid authorization code', 'invalid_grant'),
  INVALID_CLIENT: new OAuthError('Invalid client credentials', 'invalid_client'),
  ACCESS_DENIED: new OAuthError('User denied access', 'access_denied'),
  INVALID_SCOPE: new OAuthError('Invalid scope requested', 'invalid_scope'),
  TOKEN_EXPIRED: new OAuthError('Token has expired', 'token_expired'),
  NO_REFRESH_TOKEN: new OAuthError('No refresh token available', 'no_refresh_token')
};
```

### 9. Complete OAuth Handler Structure

```typescript
export class GoogleOAuthHandler {
  constructor(private env: Env) {}
  
  // Step 1: Initiate OAuth flow
  async authorize(sessionId: string): Promise<Response> {
    const state = generateState(sessionId);
    const { verifier, challenge } = await generatePKCE();
    
    // Store PKCE verifier
    await this.env.OAUTH_STATES.put(`pkce:${sessionId}`, verifier, {
      expirationTtl: 600
    });
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    // ... set parameters
    
    return Response.redirect(authUrl.toString());
  }
  
  // Step 2: Handle callback
  async callback(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    if (error) {
      throw OAUTH_ERRORS[error.toUpperCase()] || new OAuthError(error, error);
    }
    
    const sessionId = await validateState(state, this.env);
    const tokens = await this.exchangeCode(code, sessionId);
    await this.storeTokens(sessionId, tokens);
    
    return new Response('Authentication successful', { status: 200 });
  }
  
  // Step 3: Exchange code for tokens
  private async exchangeCode(code: string, sessionId: string) {
    const verifier = await this.env.OAUTH_STATES.get(`pkce:${sessionId}`);
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: this.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: verifier || ''
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new OAuthError(error.error_description, error.error);
    }
    
    return response.json();
  }
}
```

### 10. Testing OAuth Flow Locally

```bash
# 1. Set up ngrok for local testing
ngrok http 8787

# 2. Update Google Console redirect URI
https://your-ngrok-url.ngrok.io/oauth/callback

# 3. Test authorization URL
curl http://localhost:8787/oauth/authorize

# 4. Verify token exchange (use actual code from callback)
curl -X POST http://localhost:8787/oauth/callback?code=ACTUAL_CODE&state=ACTUAL_STATE
```

## Summary

This guide provides production-ready patterns for implementing Google OAuth2 in Cloudflare Workers. Key points:

1. Always request `offline` access for refresh tokens
2. Store refresh tokens permanently, access tokens temporarily
3. Use PKCE for enhanced security
4. Validate state parameter for CSRF protection
5. Handle token refresh automatically before expiration
6. Use Cloudflare KV for distributed token storage
7. Implement comprehensive error handling
8. Never expose secrets in client-side code