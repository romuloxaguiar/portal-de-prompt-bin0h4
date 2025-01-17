/**
 * Authentication utility functions for secure token management and OAuth operations
 * @version 1.0.0
 */

import { jwtDecode } from 'jwt-decode'; // Version: ^3.1.2
import { IAuthTokens } from '../interfaces/auth.interface';
import { authConfig } from '../config/auth.config';

// Milliseconds threshold before token refresh (5 minutes)
const TOKEN_REFRESH_THRESHOLD_MS = 300000;

/**
 * Custom error class for token-related errors
 */
class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

/**
 * Type definition for decoded JWT token payload
 */
interface DecodedToken {
  exp: number;
  iat: number;
  sub: string;
  [key: string]: unknown;
}

/**
 * Securely parses and validates JWT token
 * @param token - JWT token string to parse
 * @returns Decoded token payload
 * @throws TokenError if token is invalid or malformed
 */
export const parseToken = (token: string): DecodedToken => {
  if (!token || typeof token !== 'string') {
    throw new TokenError('Invalid token: Token must be a non-empty string');
  }

  // Verify token format matches JWT pattern
  const jwtPattern = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
  if (!jwtPattern.test(token)) {
    throw new TokenError('Invalid token format');
  }

  try {
    const decoded = jwtDecode<DecodedToken>(token);

    // Validate decoded token structure
    if (!decoded || typeof decoded !== 'object') {
      throw new TokenError('Invalid token structure');
    }

    if (!decoded.exp || typeof decoded.exp !== 'number') {
      throw new TokenError('Token missing expiration claim');
    }

    return decoded;
  } catch (error) {
    if (error instanceof TokenError) {
      throw error;
    }
    throw new TokenError(`Token decode error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Checks if authentication tokens are expired with safety buffer
 * @param tokens - Authentication tokens object
 * @returns boolean indicating if tokens are expired
 * @throws TokenError if tokens object is invalid
 */
export const isTokenExpired = (tokens: IAuthTokens): boolean => {
  if (!tokens?.accessToken || !tokens?.expiresIn) {
    throw new TokenError('Invalid tokens object');
  }

  try {
    const decoded = parseToken(tokens.accessToken);
    const currentTime = Date.now();
    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    
    // Add safety margin from configuration
    const safetyMargin = authConfig.tokenConfig.refreshThreshold * 1000;
    
    return currentTime >= (expirationTime - safetyMargin);
  } catch (error) {
    if (error instanceof TokenError) {
      throw error;
    }
    throw new TokenError('Token expiration check failed');
  }
};

/**
 * Checks if token needs refresh based on configured threshold
 * @param tokens - Authentication tokens object
 * @returns boolean indicating if tokens need refresh
 * @throws TokenError if tokens object is invalid
 */
export const needsRefresh = (tokens: IAuthTokens): boolean => {
  if (!tokens?.accessToken || !tokens?.expiresIn) {
    throw new TokenError('Invalid tokens object');
  }

  try {
    const decoded = parseToken(tokens.accessToken);
    const currentTime = Date.now();
    const expirationTime = decoded.exp * 1000;
    
    // Calculate refresh time using configured threshold
    const refreshTime = expirationTime - TOKEN_REFRESH_THRESHOLD_MS;
    
    return currentTime >= refreshTime;
  } catch (error) {
    if (error instanceof TokenError) {
      throw error;
    }
    throw new TokenError('Refresh check failed');
  }
};

/**
 * Generates secure authorization headers from access token
 * @param accessToken - Valid access token
 * @returns Headers object with authorization
 * @throws TokenError if token is invalid
 */
export const generateAuthHeaders = (accessToken: string): Record<string, string> => {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new TokenError('Invalid access token');
  }

  try {
    // Verify token is valid before using
    parseToken(accessToken);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'X-Request-ID': crypto.randomUUID(),
      'X-Client-Version': '1.0.0'
    };

    // Add security headers if configured
    if (authConfig.tokenConfig.secureStorage) {
      headers['X-Content-Type-Options'] = 'nosniff';
      headers['X-Frame-Options'] = 'DENY';
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }

    return headers;
  } catch (error) {
    if (error instanceof TokenError) {
      throw error;
    }
    throw new TokenError('Failed to generate auth headers');
  }
};