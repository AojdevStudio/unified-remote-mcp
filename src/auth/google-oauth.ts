/**
 * Google OAuth2 implementation for Cloudflare Workers
 * Handles authorization flow, token exchange, and user profile retrieval
 */

import { type GoogleTokens, type GoogleUserInfo, type OAuthError, AuthState } from '../types/auth.js';

export class GoogleOAuthHandler {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(clientId: string, clientSecret: string, redirectUri: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  /**
   * Generate Google OAuth2 authorization URL
   * @param state - CSRF protection state parameter
   * @returns Authorization URL for user redirect
   */
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

  /**
   * Exchange authorization code for access and refresh tokens
   * @param code - Authorization code from Google
   * @returns Token response from Google
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
    }

    // Calculate expiry time
    const expiresAt = Date.now() + (data.expires_in * 1000);
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      scope: data.scope,
      token_type: data.token_type,
    };
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Valid refresh token
   * @returns New token response
   */
  async refreshTokens(refreshToken: string): Promise<GoogleTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
    }

    // Calculate expiry time
    const expiresAt = Date.now() + (data.expires_in * 1000);
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // Keep existing refresh token if not provided
      expires_at: expiresAt,
      scope: data.scope,
      token_type: data.token_type,
    };
  }

  /**
   * Get user profile information using access token
   * @param accessToken - Valid access token
   * @returns User profile information
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${JSON.stringify(data)}`);
    }

    return data;
  }

  /**
   * Validate and parse OAuth error response
   * @param searchParams - URL search parameters from callback
   * @returns OAuth error object or null
   */
  parseOAuthError(searchParams: URLSearchParams): OAuthError | null {
    const error = searchParams.get('error');
    if (!error) return null;

    return {
      error,
      error_description: searchParams.get('error_description') || undefined,
      error_uri: searchParams.get('error_uri') || undefined,
    };
  }

  /**
   * Generate cryptographically secure state parameter
   * @returns Random state string
   */
  generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}