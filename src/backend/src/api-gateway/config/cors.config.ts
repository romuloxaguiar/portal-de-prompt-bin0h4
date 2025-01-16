/**
 * CORS Configuration Module
 * Implements comprehensive Cross-Origin Resource Sharing (CORS) settings for the API Gateway
 * with environment-specific configurations and enhanced security headers.
 * @version 1.0.0
 */

import { CorsOptions } from 'cors'; // v2.8.5
import { appConfig } from '../../common/config/app.config';

/**
 * Generates comprehensive environment-specific CORS configuration options
 * with enhanced security headers and proper preflight handling
 * @returns {CorsOptions} Configured CORS options object
 */
const getCorsOptions = (): CorsOptions => {
  const { env, corsOrigins } = appConfig;

  // Configure origin handling based on environment
  const originConfig = env === 'production'
    ? {
        // Strict origin checking in production
        origin: (origin: string, callback: (error: Error | null, allow?: boolean) => void) => {
          if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        }
      }
    : {
        // More permissive for development/staging
        origin: corsOrigins,
        optionsSuccessStatus: 200
      };

  return {
    ...originConfig,
    // Allowed HTTP methods
    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
      'PATCH'
    ],
    // Allowed request headers
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Origin',
      'X-Requested-With',
      'Accept',
      'X-Access-Token',
      'X-API-Version',
      'X-Request-ID',
      'X-CSRF-Token'
    ],
    // Headers exposed to the client
    exposedHeaders: [
      'X-Request-ID',
      'X-API-Version',
      'X-Total-Count',
      'Content-Disposition'
    ],
    // Enable credentials for authenticated requests
    credentials: true,
    // Preflight request caching (15 minutes)
    maxAge: 900,
    // Continue after preflight
    preflightContinue: false,
    // Additional security headers
    optionsSuccessStatus: 204
  };
};

/**
 * Exported CORS configuration
 * Comprehensive CORS settings with enhanced security for the API Gateway
 */
export const corsConfig: CorsOptions = Object.freeze(getCorsOptions());

/**
 * Additional security headers configuration
 * To be applied alongside CORS settings
 */
export const securityHeaders = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none';",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
});