/**
 * Google API client for making authenticated requests
 * Handles token management and API interactions
 */

import { GoogleTokens } from '../types/auth.js';
import type { TokenManager } from '../auth/token-manager.js';

export class GoogleApiClient {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  /**
   * Make authenticated request to Google API
   * @param userId - User identifier for token retrieval
   * @param url - API endpoint URL
   * @param options - Fetch options
   * @returns API response
   */
  async authenticatedFetch(
    userId: string,
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const tokens = await this.tokenManager.getValidTokens(userId);
    
    if (!tokens) {
      throw new Error('No valid tokens available for user');
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${tokens.access_token}`);

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Get user profile information
   * @param userId - User identifier
   * @returns User profile data
   */
  async getUserProfile(userId: string) {
    const response = await this.authenticatedFetch(
      userId,
      'https://www.googleapis.com/oauth2/v2/userinfo'
    );

    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Test API connectivity and token validity
   * @param userId - User identifier
   * @returns True if tokens are valid and API is accessible
   */
  async testConnection(userId: string): Promise<boolean> {
    try {
      await this.getUserProfile(userId);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}