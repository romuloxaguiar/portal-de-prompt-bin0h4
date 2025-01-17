/**
 * @fileoverview Defines standardized error constants for frontend error handling and display.
 * Provides consistent error codes, user-friendly messages, and HTTP status mappings
 * for error handling patterns across the web application.
 * @version 1.0.0
 */

/**
 * Standardized error codes for frontend error handling and monitoring integration.
 * Used to identify and track different types of errors across the application.
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROMPT_VALIDATION_ERROR = 'PROMPT_VALIDATION_ERROR',
  AI_MODEL_ERROR = 'AI_MODEL_ERROR',
  WORKSPACE_ERROR = 'WORKSPACE_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR'
}

/**
 * User-friendly error messages mapped to error codes.
 * Messages are designed to be clear, accessible, and actionable for end users.
 */
export const ErrorMessage: Readonly<Record<ErrorCode, string>> = {
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again. Ensure all required fields are filled correctly.',
  [ErrorCode.AUTHENTICATION_ERROR]: 'Your session has expired or is invalid. Please sign in again to continue.',
  [ErrorCode.AUTHORIZATION_ERROR]: "You don't have permission to perform this action. Please contact your workspace administrator.",
  [ErrorCode.NOT_FOUND_ERROR]: 'The requested resource could not be found. It may have been moved or deleted.',
  [ErrorCode.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection and try again.',
  [ErrorCode.PROMPT_VALIDATION_ERROR]: 'The prompt format is invalid. Please review the prompt guidelines and make necessary corrections.',
  [ErrorCode.AI_MODEL_ERROR]: 'There was an error communicating with the AI model. Please try again or contact support if the issue persists.',
  [ErrorCode.WORKSPACE_ERROR]: 'Unable to access the workspace. Please refresh the page or contact support if the issue continues.',
  [ErrorCode.TEMPLATE_ERROR]: 'Error processing the prompt template. Please verify the template format and variables.'
} as const;

/**
 * HTTP status code mappings for error codes following REST conventions.
 * Used for consistent error handling and monitoring across the application.
 */
export const ErrorHttpStatus: Readonly<Record<ErrorCode, number>> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.AUTHENTICATION_ERROR]: 401,
  [ErrorCode.AUTHORIZATION_ERROR]: 403,
  [ErrorCode.NOT_FOUND_ERROR]: 404,
  [ErrorCode.NETWORK_ERROR]: 503,
  [ErrorCode.PROMPT_VALIDATION_ERROR]: 422,
  [ErrorCode.AI_MODEL_ERROR]: 503,
  [ErrorCode.WORKSPACE_ERROR]: 500,
  [ErrorCode.TEMPLATE_ERROR]: 422
} as const;