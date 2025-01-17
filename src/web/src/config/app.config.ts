/**
 * Core application configuration for the Prompts Portal frontend application.
 * Implements enterprise-grade settings for security, performance, and features.
 * @version 1.0.0
 */

import { config } from 'dotenv'; // ^16.0.0
import { authConfig, type AuthConfig } from './auth.config';
import { analyticsConfig, type AnalyticsConfig } from './analytics.config';

// Load environment variables
config();

// Global constants
const API_VERSION = 'v1';
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_TIMEZONE = 'UTC';
const CONFIG_VERSION = '1.0.0';

/**
 * Comprehensive interface for application configuration
 */
interface AppConfig {
  readonly env: {
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
    isStaging: boolean;
    region: string;
    version: string;
  };
  readonly api: {
    baseUrl: string;
    version: string;
    timeout: number;
    retryAttempts: number;
    rateLimits: Record<string, number>;
    endpoints: Record<string, string>;
  };
  readonly features: {
    enableAnalytics: boolean;
    enableRealTimeCollaboration: boolean;
    enablePromptOptimization: boolean;
    enableVersionHistory: boolean;
    enableTeamWorkspaces: boolean;
    enableAIIntegration: boolean;
    enableCustomTemplates: boolean;
  };
  readonly performance: {
    targetResponseTime: number;
    targetUptime: number;
    maxConcurrentRequests: number;
    cacheTimeout: number;
  };
  readonly security: {
    corsOrigins: string[];
    maxTokenAge: number;
    requireMfa: boolean;
    passwordPolicy: {
      minLength: number;
      requireSpecialChars: boolean;
    };
    rateLimiting: {
      maxRequests: number;
      windowMs: number;
    };
  };
}

/**
 * Validates API URL format
 * @param url URL to validate
 * @returns boolean indicating if URL is valid
 */
const validateApiUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Constructs full API URL for a given endpoint
 * @param endpoint API endpoint path
 * @returns Complete API URL
 * @throws Error if endpoint is invalid
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = appConfig.api.baseUrl;
  if (!validateApiUrl(baseUrl)) {
    throw new Error('Invalid API base URL configuration');
  }
  if (!appConfig.api.endpoints[endpoint]) {
    throw new Error(`Invalid endpoint: ${endpoint}`);
  }
  return `${baseUrl}${appConfig.api.endpoints[endpoint]}`;
};

/**
 * Checks if a specific feature is enabled
 * @param featureKey Feature to check
 * @returns boolean indicating if feature is enabled
 */
export const isFeatureEnabled = (featureKey: keyof AppConfig['features']): boolean => {
  if (!(featureKey in appConfig.features)) {
    console.warn(`Unknown feature key: ${featureKey}`);
    return false;
  }
  return appConfig.features[featureKey];
};

/**
 * Validates the entire configuration object
 * @param config Configuration to validate
 * @returns boolean indicating if configuration is valid
 */
export const validateConfig = (config: AppConfig): boolean => {
  // Validate required environment variables
  if (!config.api.baseUrl) {
    throw new Error('API base URL is required');
  }

  // Validate API configuration
  if (!validateApiUrl(config.api.baseUrl)) {
    throw new Error('Invalid API base URL format');
  }

  // Validate security settings
  if (config.security.maxTokenAge < 300) {
    throw new Error('Token age must be at least 300 seconds');
  }

  // Validate performance settings
  if (config.performance.targetResponseTime <= 0) {
    throw new Error('Invalid target response time');
  }

  return true;
};

/**
 * Core application configuration object
 */
export const appConfig: AppConfig = {
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    isStaging: process.env.NODE_ENV === 'staging',
    region: process.env.VITE_APP_REGION || 'us-east-1',
    version: CONFIG_VERSION
  },
  api: {
    baseUrl: process.env.VITE_API_BASE_URL as string,
    version: API_VERSION,
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    rateLimits: {
      promptRequests: 1000,
      analyticsRequests: 500
    },
    endpoints: {
      prompts: '/api/v1/prompts',
      templates: '/api/v1/templates',
      workspaces: '/api/v1/workspaces',
      analytics: '/api/v1/analytics',
      users: '/api/v1/users',
      auth: '/api/v1/auth',
      ai: '/api/v1/ai',
      collaboration: '/api/v1/collaboration'
    }
  },
  features: {
    enableAnalytics: true,
    enableRealTimeCollaboration: true,
    enablePromptOptimization: true,
    enableVersionHistory: true,
    enableTeamWorkspaces: true,
    enableAIIntegration: true,
    enableCustomTemplates: true
  },
  performance: {
    targetResponseTime: 2000, // 2 seconds
    targetUptime: 99.9, // 99.9% uptime target
    maxConcurrentRequests: 50,
    cacheTimeout: 3600 // 1 hour
  },
  security: {
    corsOrigins: [process.env.VITE_ALLOWED_ORIGINS as string],
    maxTokenAge: 3600, // 1 hour
    requireMfa: true,
    passwordPolicy: {
      minLength: 12,
      requireSpecialChars: true
    },
    rateLimiting: {
      maxRequests: 1000,
      windowMs: 3600000 // 1 hour
    }
  }
};

// Validate configuration on initialization
validateConfig(appConfig);

export default appConfig;