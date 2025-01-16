/**
 * Request Interfaces
 * 
 * Defines standardized TypeScript interfaces for request handling across the Prompts Portal application.
 * Provides type-safe request structures for API endpoints, authentication, and request metadata.
 * 
 * @version 1.0.0
 */

import { HttpStatus } from '../constants/http-status.constant';

/**
 * Base interface that all API requests must implement.
 * Provides core request metadata for tracing and monitoring.
 */
export interface BaseRequest {
  /**
   * Unique request identifier using UUID v4
   */
  id: string;

  /**
   * ISO 8601 formatted request timestamp
   */
  timestamp: Date;

  /**
   * Unique correlation ID for request tracing across services
   */
  correlationId: string;
}

/**
 * Interface for requests requiring authentication.
 * Extends BaseRequest with user context and security metadata.
 */
export interface AuthenticatedRequest extends BaseRequest {
  /**
   * UUID of the authenticated user
   */
  userId: string;

  /**
   * UUID of the current workspace context
   */
  workspaceId: string;

  /**
   * Array of user role identifiers
   * @example ['admin', 'editor', 'viewer']
   */
  roles: string[];

  /**
   * Array of granular permission codes
   * @example ['prompts.create', 'prompts.edit', 'analytics.view']
   */
  permissions: string[];
}

/**
 * Interface for paginated requests.
 * Extends BaseRequest with standardized pagination parameters.
 */
export interface PaginatedRequest extends BaseRequest {
  /**
   * Zero-based page number
   * @minimum 0
   */
  page: number;

  /**
   * Maximum items per page
   * @minimum 1
   * @maximum 100
   */
  limit: number;

  /**
   * Field name to sort by
   */
  sortBy: string;

  /**
   * Sort direction (ascending or descending)
   */
  sortOrder: 'asc' | 'desc';
}

/**
 * Interface for filtered requests.
 * Extends BaseRequest with filtering and search capabilities.
 */
export interface FilteredRequest extends BaseRequest {
  /**
   * Type-safe filter criteria object
   * @example { status: 'active', category: 'sales' }
   */
  filters: Record<string, unknown>;

  /**
   * Optional search query string
   */
  search?: string;
}

/**
 * Type guard to check if a request is authenticated
 * @param request - Request object to check
 * @returns boolean indicating if request is authenticated
 */
export function isAuthenticatedRequest(request: BaseRequest): request is AuthenticatedRequest {
  return (
    'userId' in request &&
    'workspaceId' in request &&
    'roles' in request &&
    'permissions' in request
  );
}

/**
 * Type guard to check if a request is paginated
 * @param request - Request object to check
 * @returns boolean indicating if request is paginated
 */
export function isPaginatedRequest(request: BaseRequest): request is PaginatedRequest {
  return (
    'page' in request &&
    'limit' in request &&
    'sortBy' in request &&
    'sortOrder' in request
  );
}

/**
 * Type guard to check if a request is filtered
 * @param request - Request object to check
 * @returns boolean indicating if request is filtered
 */
export function isFilteredRequest(request: BaseRequest): request is FilteredRequest {
  return 'filters' in request;
}