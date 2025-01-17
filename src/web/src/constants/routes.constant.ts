/**
 * @fileoverview Centralized route constants for the Prompts Portal application.
 * Defines all frontend navigation paths and route configurations to support
 * consistent navigation and authentication flows.
 * @version 1.0.0
 */

/**
 * Application route paths used for navigation and route protection.
 * These constants are used across the application to maintain consistent
 * routing and support the OAuth 2.0 authentication flow.
 * 
 * @constant
 * @type {Object.<string, string>}
 */
export const ROUTES = {
  /** Authentication route for OAuth 2.0 login flow */
  LOGIN: '/login',

  /** Main dashboard view after successful authentication */
  DASHBOARD: '/dashboard',

  /** Analytics and metrics visualization route */
  ANALYTICS: '/analytics',

  /** Prompt library listing and management route */
  PROMPT_LIBRARY: '/prompts',

  /** Individual prompt detail view with :id parameter */
  PROMPT_DETAIL: '/prompts/:id',

  /** Application and user settings configuration route */
  SETTINGS: '/settings',

  /** Team management and collaboration settings route */
  TEAM_MANAGEMENT: '/team',

  /** Workspace detail view with :id parameter */
  WORKSPACE_DETAIL: '/workspace/:id',

  /** Catch-all route for 404 Not Found pages */
  NOT_FOUND: '*'
} as const;

/**
 * Type definition for route paths to ensure type safety when using routes
 * throughout the application.
 */
export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

/**
 * Type guard to check if a given path is a valid application route
 * @param path - The path to check
 * @returns boolean indicating if the path is a valid route
 */
export const isValidRoute = (path: string): path is RoutePath => {
  return Object.values(ROUTES).includes(path as RoutePath);
};

/**
 * Helper function to generate dynamic route paths with parameters
 * @param route - The route template with parameter placeholders
 * @param params - Object containing parameter values
 * @returns The formatted route path with replaced parameters
 */
export const generatePath = (route: RoutePath, params: Record<string, string | number>): string => {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, String(value)),
    route
  );
};