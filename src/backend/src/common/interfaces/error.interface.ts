/**
 * @fileoverview Core error interfaces for standardized error handling across the Prompts Portal application.
 * These interfaces support consistent error classification, monitoring, and security auditing capabilities.
 * 
 * @version 1.0.0
 */

import { ErrorCode } from '../constants/error-codes.constant';
import { HttpStatus } from '../constants/http-status.constant';

/**
 * Base error interface that all application errors must implement.
 * Provides core error properties for consistent error handling and monitoring.
 * 
 * @interface BaseError
 */
export interface BaseError {
  /**
   * Standardized error code for error classification and monitoring
   */
  code: ErrorCode;

  /**
   * Human-readable error message describing the error
   */
  message: string;

  /**
   * HTTP status code associated with the error response
   */
  status: HttpStatus;

  /**
   * Timestamp when the error occurred
   */
  timestamp: Date;

  /**
   * Optional additional context and details about the error
   * Useful for debugging and detailed error tracking
   */
  details?: Record<string, unknown>;
}

/**
 * Interface for validation-related errors.
 * Extends BaseError to include field-specific validation details.
 * 
 * @interface ValidationError
 * @extends {BaseError}
 */
export interface ValidationError extends BaseError {
  /**
   * Array of validation errors with field names and error messages
   */
  validationErrors: Array<{
    /**
     * Name of the field that failed validation
     */
    field: string;

    /**
     * Validation error message for the field
     */
    message: string;
  }>;
}

/**
 * Interface for authentication and authorization errors.
 * Extends BaseError to include security-specific error details.
 * 
 * @interface AuthError
 * @extends {BaseError}
 */
export interface AuthError extends BaseError {
  /**
   * Optional ID of the user related to the authentication error
   */
  userId?: string;

  /**
   * Optional array of permissions required for the operation
   * Used for authorization failures and audit logging
   */
  requiredPermissions?: string[];
}