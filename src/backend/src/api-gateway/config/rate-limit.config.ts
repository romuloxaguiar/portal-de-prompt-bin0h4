/**
 * Rate limiting configuration for the API Gateway
 * Implements request limits, window periods, and rate limiting strategies
 * to prevent abuse and ensure fair usage of the API
 * @version 1.0.0
 */

import { Options } from 'express-rate-limit'; // ^6.7.0
import { RedisStore } from 'rate-limit-redis'; // ^3.0.0
import { AppConfig } from '../../common/interfaces/config.interface';

// Time windows in milliseconds
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const PROMPT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Request limits per window
const DEFAULT_MAX_REQUESTS = 1000; // General API endpoints
const AUTH_MAX_REQUESTS = 100; // Authentication endpoints
const PROMPT_MAX_REQUESTS = 5000; // Prompt-related endpoints

/**
 * Rate limit configuration interface extending express-rate-limit Options
 * Defines the structure for rate limiting settings
 */
export interface RateLimitConfig extends Options {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  store: RedisStore;
}

/**
 * Creates a Redis store instance for distributed rate limiting
 * @param config Application configuration
 * @returns Configured RedisStore instance
 */
const createRedisStore = (config: AppConfig): RedisStore => {
  return new RedisStore({
    // Redis connection configuration would be injected here
    // This is a placeholder for the actual Redis client configuration
    prefix: 'rl:', // Rate limit key prefix
    resetExpiryOnChange: true,
    // Additional Redis store options can be configured based on needs
  });
};

/**
 * Rate limiting configuration factory
 * Creates rate limit configurations for different API endpoints
 * @param config Application configuration
 */
export const createRateLimitConfig = (config: AppConfig) => {
  const store = createRedisStore(config);
  
  const baseConfig = {
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable legacy X-RateLimit headers
    store,
    skipFailedRequests: false, // Count failed requests against the rate limit
    skipSuccessfulRequests: false, // Count successful requests against the rate limit
    requestWasSuccessful: (req: any) => req.statusCode < 400, // Define successful requests
  };

  return {
    // Default rate limits for general API endpoints
    defaultLimits: {
      ...baseConfig,
      windowMs: DEFAULT_WINDOW_MS,
      max: DEFAULT_MAX_REQUESTS,
      message: 'Too many requests, please try again later.',
    } as RateLimitConfig,

    // Stricter limits for authentication endpoints
    authLimits: {
      ...baseConfig,
      windowMs: AUTH_WINDOW_MS,
      max: AUTH_MAX_REQUESTS,
      message: 'Too many authentication attempts, please try again later.',
    } as RateLimitConfig,

    // Higher limits for prompt-related endpoints
    promptLimits: {
      ...baseConfig,
      windowMs: PROMPT_WINDOW_MS,
      max: PROMPT_MAX_REQUESTS,
      message: 'Prompt request limit exceeded, please try again later.',
    } as RateLimitConfig,
  };
};

/**
 * Default rate limit configuration object
 * Used when specific configuration is not provided
 */
export const rateLimitConfig = {
  defaultLimits: {
    windowMs: DEFAULT_WINDOW_MS,
    max: DEFAULT_MAX_REQUESTS,
    standardHeaders: true,
    store: new RedisStore(),
  } as RateLimitConfig,
  
  authLimits: {
    windowMs: AUTH_WINDOW_MS,
    max: AUTH_MAX_REQUESTS,
    standardHeaders: true,
    store: new RedisStore(),
  } as RateLimitConfig,
  
  promptLimits: {
    windowMs: PROMPT_WINDOW_MS,
    max: PROMPT_MAX_REQUESTS,
    standardHeaders: true,
    store: new RedisStore(),
  } as RateLimitConfig,
};