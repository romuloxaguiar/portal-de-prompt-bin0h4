/**
 * Application Configuration Module
 * Provides centralized configuration management for the Prompts Portal backend services
 * with enhanced validation and type safety.
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { AppConfig } from '../interfaces/config.interface';

// Load environment variables
config();

/**
 * Validates port number range and format
 * @param port - Port number to validate
 * @throws Error if port is invalid
 */
const validatePort = (port: number): boolean => {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Port must be an integer between 1024 and 65535');
  }
  return true;
};

/**
 * Validates environment name against allowed values
 * @param env - Environment name to validate
 * @throws Error if environment is invalid
 */
const validateEnvironment = (env: string): boolean => {
  const allowedEnvs = ['development', 'staging', 'production'];
  if (!allowedEnvs.includes(env)) {
    throw new Error(`Environment must be one of: ${allowedEnvs.join(', ')}`);
  }
  return true;
};

/**
 * Validates API version format
 * @param version - API version string to validate
 * @throws Error if version format is invalid
 */
const validateApiVersion = (version: string): boolean => {
  if (!/^v\d+$/.test(version)) {
    throw new Error('API version must be in format "v1", "v2", etc.');
  }
  return true;
};

/**
 * Validates CORS origins for security
 * @param origins - Array of CORS origins to validate
 * @throws Error if origins are invalid or insecure
 */
const validateCorsOrigins = (origins: string[]): boolean => {
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new Error('CORS origins must be a non-empty array');
  }

  origins.forEach(origin => {
    if (!/^https?:\/\/[\w-]+(\.[\w-]+)+(:\d+)?$/.test(origin)) {
      throw new Error(`Invalid CORS origin format: ${origin}`);
    }
  });
  return true;
};

/**
 * Validates the complete configuration object
 * @param config - Configuration object to validate
 * @throws Error if any configuration value is invalid
 */
const validateConfig = (config: Partial<AppConfig>): boolean => {
  if (!config.port || !config.env || !config.apiVersion || !config.corsOrigins) {
    throw new Error('Missing required configuration values');
  }

  validatePort(config.port);
  validateEnvironment(config.env);
  validateApiVersion(config.apiVersion);
  validateCorsOrigins(config.corsOrigins);

  return true;
};

/**
 * Loads and validates application configuration from environment variables
 * @returns Validated AppConfig instance
 * @throws Error if configuration is invalid or missing required values
 */
const loadConfig = (): AppConfig => {
  // Parse and validate port
  const port = parseInt(process.env.PORT || '3000', 10);
  
  // Parse CORS origins
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // Create configuration object
  const config: AppConfig = {
    port,
    env: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',
    corsOrigins,
    logLevel: process.env.LOG_LEVEL || 'info',
    rateLimits: {
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '3600000', 10),
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false'
    }
  };

  // Validate configuration
  validateConfig(config);

  // Return immutable configuration object
  return Object.freeze(config);
};

/**
 * Exported application configuration instance
 * Immutable, validated configuration object for use across the application
 */
export const appConfig = loadConfig();