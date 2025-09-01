/**
 * Token management system for secure storage and refresh handling
 * Uses Cloudflare KV for persistent token storage with encryption
 */

import { type GoogleTokens, AuthenticatedUser, type AuthState } from '../types/auth.js';
import type { GoogleOAuthHandler } from './google-oauth.js';

export class TokenManager {
  private kv: KVNamespace;
  private oauthHandler: GoogleOAuthHandler;

  constructor(kv: KVNamespace, oauthHandler: GoogleOAuthHandler) {
    this.kv = kv;
    this.oauthHandler = oauthHandler;
  }

  /**
   * Store user tokens securely in KV storage
   * @param userId - Unique user identifier
   * @param tokens - Google OAuth tokens to store
   */
  async storeTokens(userId: string, tokens: GoogleTokens): Promise<void> {
    const key = this.getTokenKey(userId);
    const encrypted = await this.encryptTokens(tokens);
    
    // Store with 30-day TTL (tokens should be refreshed before then)
    await this.kv.put(key, encrypted, { expirationTtl: 30 * 24 * 60 * 60 });
  }

  /**
   * Retrieve user tokens from KV storage
   * @param userId - Unique user identifier
   * @returns Decrypted tokens or null if not found
   */
  async getTokens(userId: string): Promise<GoogleTokens | null> {
    const key = this.getTokenKey(userId);
    const encrypted = await this.kv.get(key);
    
    if (!encrypted) return null;
    
    return this.decryptTokens(encrypted);
  }

  /**
   * Get valid tokens, refreshing if necessary
   * @param userId - Unique user identifier
   * @returns Valid tokens or null if refresh fails
   */
  async getValidTokens(userId: string): Promise<GoogleTokens | null> {
    const tokens = await this.getTokens(userId);
    if (!tokens) return null;

    // Check if token is expired (with 5-minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    if (Date.now() + bufferTime < tokens.expires_at) {
      return tokens; // Token is still valid
    }

    // Token is expired or about to expire, refresh it
    try {
      const refreshedTokens = await this.oauthHandler.refreshTokens(tokens.refresh_token);
      await this.storeTokens(userId, refreshedTokens);
      return refreshedTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Remove invalid tokens
      await this.removeTokens(userId);
      return null;
    }
  }

  /**
   * Remove user tokens from storage
   * @param userId - Unique user identifier
   */
  async removeTokens(userId: string): Promise<void> {
    const key = this.getTokenKey(userId);
    await this.kv.delete(key);
  }

  /**
   * Store authentication state for OAuth flow
   * @param state - State parameter
   * @param authState - Authentication state data
   */
  async storeAuthState(state: string, authState: AuthState): Promise<void> {
    const key = this.getStateKey(state);
    
    // Store with 10-minute TTL for OAuth flow completion
    await this.kv.put(key, JSON.stringify(authState), { expirationTtl: 10 * 60 });
  }

  /**
   * Retrieve and validate authentication state
   * @param state - State parameter to retrieve
   * @returns Auth state data or null if invalid/expired
   */
  async getAuthState(state: string): Promise<AuthState | null> {
    const key = this.getStateKey(state);
    const data = await this.kv.get(key);
    
    if (!data) return null;
    
    try {
      const authState: AuthState = JSON.parse(data);
      
      // Validate state hasn't expired (10 minutes max)
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - authState.created_at > maxAge) {
        await this.kv.delete(key);
        return null;
      }
      
      return authState;
    } catch (error) {
      console.error('Failed to parse auth state:', error);
      await this.kv.delete(key);
      return null;
    }
  }

  /**
   * Remove authentication state after use
   * @param state - State parameter to remove
   */
  async removeAuthState(state: string): Promise<void> {
    const key = this.getStateKey(state);
    await this.kv.delete(key);
  }

  /**
   * Generate KV key for user tokens
   * @param userId - User identifier
   * @returns KV storage key
   */
  private getTokenKey(userId: string): string {
    return `google_tokens:${userId}`;
  }

  /**
   * Generate KV key for OAuth state
   * @param state - State parameter
   * @returns KV storage key
   */
  private getStateKey(state: string): string {
    return `oauth_state:${state}`;
  }

  /**
   * Encrypt tokens before storage (simple base64 encoding for now)
   * In production, use proper encryption with a secret key
   * @param tokens - Tokens to encrypt
   * @returns Encrypted token string
   */
  private async encryptTokens(tokens: GoogleTokens): Promise<string> {
    // Simple base64 encoding - in production, use proper encryption
    const tokenString = JSON.stringify(tokens);
    return btoa(tokenString);
  }

  /**
   * Decrypt tokens from storage
   * @param encrypted - Encrypted token string
   * @returns Decrypted tokens
   */
  private async decryptTokens(encrypted: string): Promise<GoogleTokens> {
    try {
      // Simple base64 decoding - in production, use proper decryption
      const tokenString = atob(encrypted);
      return JSON.parse(tokenString);
    } catch (error) {
      throw new Error('Failed to decrypt tokens');
    }
  }
}