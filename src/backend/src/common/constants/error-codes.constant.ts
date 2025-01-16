/**
 * @fileoverview Standardized error codes for consistent error handling and classification
 * across the Prompts Portal application. These codes are used in conjunction with HTTP
 * status codes to provide detailed error reporting and support system observability.
 * 
 * The error codes are organized into categories:
 * - HTTP-like errors (400-500 series)
 * - Security-related errors (AUTH/ACCESS)
 * - Business domain errors (PROMPT/WORKSPACE/TEMPLATE)
 * - Infrastructure errors (SERVICE/AI)
 * 
 * @version 1.0.0
 */

/**
 * Enum containing standardized error codes used across the application for
 * error handling, monitoring, and security auditing.
 * 
 * These codes support:
 * - Consistent error classification
 * - Detailed error tracking
 * - Security incident monitoring
 * - System-wide troubleshooting
 * - Compliance reporting
 */
export enum ErrorCode {
  /**
   * General input validation errors
   * Used when request parameters, body, or query fail validation rules
   */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /**
   * User authentication failures
   * Used for login failures, invalid tokens, or expired credentials
   */
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',

  /**
   * Permission and access control violations
   * Used when authenticated users attempt unauthorized actions
   */
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',

  /**
   * Resource not found errors
   * Used when requested resources (prompts, workspaces, templates) don't exist
   */
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',

  /**
   * Resource conflict and concurrent modification errors
   * Used for version conflicts, duplicate resources, or concurrent updates
   */
  CONFLICT_ERROR = 'CONFLICT_ERROR',

  /**
   * API rate limit exceeded errors
   * Used when request quotas or rate limits are exceeded
   */
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',

  /**
   * Unexpected system errors
   * Used for unhandled exceptions and critical system failures
   */
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',

  /**
   * Service availability and dependency errors
   * Used when dependent services or infrastructure components are unavailable
   */
  SERVICE_UNAVAILABLE_ERROR = 'SERVICE_UNAVAILABLE_ERROR',

  /**
   * Prompt-specific validation and format errors
   * Used for prompt content, structure, or variable validation failures
   */
  PROMPT_VALIDATION_ERROR = 'PROMPT_VALIDATION_ERROR',

  /**
   * AI model integration and processing errors
   * Used for AI service failures, timeouts, or processing errors
   */
  AI_MODEL_ERROR = 'AI_MODEL_ERROR',

  /**
   * Workspace management and access errors
   * Used for workspace configuration, access, or operation failures
   */
  WORKSPACE_ERROR = 'WORKSPACE_ERROR',

  /**
   * Template processing and validation errors
   * Used for template syntax, variable, or processing failures
   */
  TEMPLATE_ERROR = 'TEMPLATE_ERROR'
}