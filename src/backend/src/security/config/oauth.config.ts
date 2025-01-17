/**
 * OAuth 2.0 Configuration for Prompts Portal
 * Implements secure authentication flows and provider management
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { AppConfig } from '../../common/interfaces/config.interface';

// Initialize environment variables
config();

// Global JWT configuration constants with strict validation
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  throw new Error('JWT_SECRET must be defined in environment variables');
})();

const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || '7d';

/**
 * OAuth provider configuration interface with required security parameters
 */
export interface OAuthProviderConfig {
  /** OAuth client identifier */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** Provider's authorization endpoint */
  authorizeUrl: string;
  /** Token endpoint for access token retrieval */
  tokenUrl: string;
  /** User information endpoint */
  userInfoUrl: string;
  /** Required OAuth scopes */
  scope: string[];
  /** OAuth callback URL */
  callbackUrl: string;
}

/**
 * Complete OAuth configuration interface including providers and JWT settings
 */
export interface OAuthConfig {
  /** Map of provider configurations */
  providers: Record<string, OAuthProviderConfig>;
  /** Default authentication provider */
  defaultProvider: string;
  /** JWT token configuration */
  jwtOptions: {
    secret: string;
    accessTokenExpiration: string;
    refreshTokenExpiration: string;
    algorithm: 'RS256';
    issuer: string;
    audience: string;
  };
}

/**
 * Default OAuth configuration with secure defaults
 */
const defaultOAuthConfig: OAuthConfig = {
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
      scope: ['openid', 'profile', 'email'],
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || '',
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scope: ['openid', 'profile', 'email', 'User.Read'],
      callbackUrl: process.env.MICROSOFT_CALLBACK_URL || '',
    },
  },
  defaultProvider: 'google',
  jwtOptions: {
    secret: JWT_SECRET,
    accessTokenExpiration: JWT_EXPIRATION,
    refreshTokenExpiration: REFRESH_TOKEN_EXPIRATION,
    algorithm: 'RS256',
    issuer: 'prompts-portal',
    audience: 'prompts-portal-api',
  },
};

/**
 * Retrieves and validates configuration for a specific OAuth provider
 * @param providerName - Name of the OAuth provider
 * @returns Validated provider configuration
 * @throws Error if provider configuration is invalid or missing
 */
export function getProviderConfig(providerName: string): OAuthProviderConfig {
  const provider = defaultOAuthConfig.providers[providerName];
  
  if (!provider) {
    throw new Error(`OAuth provider '${providerName}' not configured`);
  }

  // Validate required configuration fields
  const requiredFields: (keyof OAuthProviderConfig)[] = [
    'clientId',
    'clientSecret',
    'authorizeUrl',
    'tokenUrl',
    'userInfoUrl',
    'scope',
    'callbackUrl',
  ];

  for (const field of requiredFields) {
    if (!provider[field]) {
      throw new Error(`Missing required OAuth configuration field '${field}' for provider '${providerName}'`);
    }
  }

  // Validate callback URL format
  try {
    new URL(provider.callbackUrl);
  } catch {
    throw new Error(`Invalid callback URL for provider '${providerName}'`);
  }

  // Validate required scopes
  if (!provider.scope.includes('openid')) {
    throw new Error(`Provider '${providerName}' must include 'openid' scope`);
  }

  return provider;
}

/**
 * Exported OAuth configuration with validation
 */
export const oauthConfig: OAuthConfig = Object.freeze({
  ...defaultOAuthConfig,
  providers: Object.freeze(defaultOAuthConfig.providers),
  jwtOptions: Object.freeze(defaultOAuthConfig.jwtOptions),
});