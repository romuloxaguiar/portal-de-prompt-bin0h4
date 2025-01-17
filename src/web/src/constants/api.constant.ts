/**
 * API endpoint constants and configuration for the Prompts Portal application.
 * Implements standardized versioning, security, and performance considerations.
 * @version 1.0.0
 */

import { appConfig } from '../config/app.config';

// API version and base configuration
const API_VERSION = 'v1';
const BASE_PATH = `/api/${API_VERSION}`;
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

/**
 * HTTP method constants for type-safe API calls
 */
export enum API_METHODS {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

/**
 * Comprehensive API endpoint constants for all services
 * Implements versioned paths with standardized structure
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${BASE_PATH}/auth/login`,
    LOGOUT: `${BASE_PATH}/auth/logout`,
    REFRESH: `${BASE_PATH}/auth/refresh`,
    VERIFY: `${BASE_PATH}/auth/verify`,
    MFA: `${BASE_PATH}/auth/mfa`,
    STATUS: `${BASE_PATH}/auth/status`
  },
  PROMPTS: {
    BASE: `${BASE_PATH}/prompts`,
    BY_ID: `${BASE_PATH}/prompts/:id`,
    VERSIONS: `${BASE_PATH}/prompts/:id/versions`,
    TEST: `${BASE_PATH}/prompts/:id/test`,
    OPTIMIZE: `${BASE_PATH}/prompts/:id/optimize`,
    SHARE: `${BASE_PATH}/prompts/:id/share`,
    METRICS: `${BASE_PATH}/prompts/:id/metrics`,
    EXPORT: `${BASE_PATH}/prompts/:id/export`
  },
  TEMPLATES: {
    BASE: `${BASE_PATH}/templates`,
    BY_ID: `${BASE_PATH}/templates/:id`,
    CATEGORIES: `${BASE_PATH}/templates/categories`,
    POPULAR: `${BASE_PATH}/templates/popular`,
    RECOMMENDED: `${BASE_PATH}/templates/recommended`
  },
  WORKSPACES: {
    BASE: `${BASE_PATH}/workspaces`,
    BY_ID: `${BASE_PATH}/workspaces/:id`,
    MEMBERS: `${BASE_PATH}/workspaces/:id/members`,
    SETTINGS: `${BASE_PATH}/workspaces/:id/settings`,
    ACTIVITY: `${BASE_PATH}/workspaces/:id/activity`,
    METRICS: `${BASE_PATH}/workspaces/:id/metrics`
  },
  ANALYTICS: {
    BASE: `${BASE_PATH}/analytics`,
    METRICS: `${BASE_PATH}/analytics/metrics`,
    REPORTS: `${BASE_PATH}/analytics/reports`,
    USAGE: `${BASE_PATH}/analytics/usage`,
    PERFORMANCE: `${BASE_PATH}/analytics/performance`,
    EXPORT: `${BASE_PATH}/analytics/export`,
    CUSTOM: `${BASE_PATH}/analytics/custom`
  },
  USERS: {
    BASE: `${BASE_PATH}/users`,
    PROFILE: `${BASE_PATH}/users/profile`,
    PREFERENCES: `${BASE_PATH}/users/preferences`,
    ACTIVITY: `${BASE_PATH}/users/activity`,
    SECURITY: `${BASE_PATH}/users/security`
  },
  AI: {
    OPENAI: `${BASE_PATH}/ai/openai`,
    ANTHROPIC: `${BASE_PATH}/ai/anthropic`,
    GOOGLE: `${BASE_PATH}/ai/google`,
    STATUS: `${BASE_PATH}/ai/status`,
    METRICS: `${BASE_PATH}/ai/metrics`
  }
} as const;

/**
 * Validates and constructs a complete API URL with parameters
 * @param endpoint Base endpoint path
 * @param params URL parameters to replace
 * @returns Complete API URL with replaced parameters
 */
export const getEndpointUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${appConfig.api.baseUrl}${endpoint}`;
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    });
  }
  
  return url;
};

/**
 * Validates if an endpoint exists in the API_ENDPOINTS constant
 * @param endpoint Endpoint path to validate
 * @returns boolean indicating if endpoint exists
 */
export const isValidEndpoint = (endpoint: string): boolean => {
  return Object.values(API_ENDPOINTS)
    .some(category => Object.values(category)
      .includes(endpoint));
};

/**
 * Type guard for API method validation
 * @param method HTTP method to validate
 * @returns boolean indicating if method is valid
 */
export const isValidMethod = (method: string): method is API_METHODS => {
  return Object.values(API_METHODS).includes(method as API_METHODS);
};