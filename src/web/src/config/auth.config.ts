/**
 * Frontend authentication configuration for OAuth providers and token management
 * @version 1.0.0
 * Implements OAuth 2.0 authentication flow with strict security controls
 */

import { AuthProvider } from '../interfaces/auth.interface';

// Version: process ^0.11.10
import process from 'process';

/**
 * Base API URL for authentication endpoints
 */
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Interface for OAuth provider configuration with strict typing
 */
interface OAuthProviderConfig {
  clientId: string;
  authorizeUrl: string;
  scope: string[];
  callbackUrl: string;
  isConfigured: boolean;
  tokenEndpoint: string;
  validationRules: {
    requiredScopes: string[];
    tokenValidation: boolean;
  };
}

/**
 * Interface for token management configuration
 */
interface TokenConfig {
  storageKey: string;
  refreshThreshold: number; // Seconds before token expiry to trigger refresh
  maxTokenAge: number; // Maximum token lifetime in seconds
  secureStorage: boolean;
  refreshStrategy: {
    type: 'sliding' | 'fixed';
    minimumValidity: number;
  };
}

/**
 * Validates OAuth provider configuration completeness and correctness
 * @param config Provider configuration to validate
 * @returns boolean indicating configuration validity
 */
const validateProviderConfig = (config: OAuthProviderConfig): boolean => {
  if (!config.clientId || !config.authorizeUrl || !config.callbackUrl) {
    return false;
  }

  // Validate URL formats
  try {
    new URL(config.authorizeUrl);
    new URL(config.callbackUrl);
    new URL(config.tokenEndpoint);
  } catch {
    return false;
  }

  // Verify required scopes
  return config.validationRules.requiredScopes.every(
    scope => config.scope.includes(scope)
  );
};

/**
 * Retrieves and validates configuration for a specific OAuth provider
 * @param provider OAuth provider to get configuration for
 * @returns Validated provider configuration
 * @throws Error if provider configuration is invalid
 */
const getProviderConfig = (provider: AuthProvider): OAuthProviderConfig => {
  const config = defaultAuthConfig.providers[provider];
  
  if (!config) {
    throw new Error(`Provider ${provider} not configured`);
  }

  if (!config.isConfigured) {
    throw new Error(`Provider ${provider} missing required environment variables`);
  }

  if (!validateProviderConfig(config)) {
    throw new Error(`Invalid configuration for provider ${provider}`);
  }

  return config;
};

/**
 * Default authentication configuration object
 */
const defaultAuthConfig = {
  providers: {
    [AuthProvider.GOOGLE]: {
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: ['openid', 'profile', 'email'],
      callbackUrl: process.env.REACT_APP_GOOGLE_CALLBACK_URL,
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      isConfigured: Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID),
      validationRules: {
        requiredScopes: ['openid', 'email'],
        tokenValidation: true
      }
    },
    [AuthProvider.GITHUB]: {
      clientId: process.env.REACT_APP_GITHUB_CLIENT_ID,
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      scope: ['user', 'user:email'],
      callbackUrl: process.env.REACT_APP_GITHUB_CALLBACK_URL,
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      isConfigured: Boolean(process.env.REACT_APP_GITHUB_CLIENT_ID),
      validationRules: {
        requiredScopes: ['user:email'],
        tokenValidation: true
      }
    },
    [AuthProvider.MICROSOFT]: {
      clientId: process.env.REACT_APP_MICROSOFT_CLIENT_ID,
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      scope: ['openid', 'profile', 'email', 'User.Read'],
      callbackUrl: process.env.REACT_APP_MICROSOFT_CALLBACK_URL,
      tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      isConfigured: Boolean(process.env.REACT_APP_MICROSOFT_CLIENT_ID),
      validationRules: {
        requiredScopes: ['openid', 'email'],
        tokenValidation: true
      }
    }
  },
  defaultProvider: AuthProvider.GOOGLE,
  tokenConfig: {
    storageKey: 'auth_tokens',
    refreshThreshold: 300, // 5 minutes
    maxTokenAge: 3600, // 1 hour
    secureStorage: true,
    refreshStrategy: {
      type: 'sliding',
      minimumValidity: 300 // 5 minutes
    }
  }
} as const;

/**
 * Exported authentication configuration
 */
export const authConfig = {
  providers: defaultAuthConfig.providers,
  defaultProvider: defaultAuthConfig.defaultProvider,
  tokenConfig: defaultAuthConfig.tokenConfig
} as const;

export type { OAuthProviderConfig, TokenConfig };