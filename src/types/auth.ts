/**
 * Authentication type definitions for Google OAuth2 integration
 */

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  google_tokens?: GoogleTokens;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
}

export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface AuthState {
  state: string;
  redirect_uri: string;
  created_at: number;
}