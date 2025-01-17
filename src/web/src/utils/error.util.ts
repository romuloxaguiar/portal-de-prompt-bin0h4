/**
 * @fileoverview Centralized error handling utility for frontend application.
 * Provides standardized error creation, handling, logging, and monitoring integration.
 * @version 1.0.0
 */

import * as Sentry from '@sentry/browser'; // v7.0.0
import { ErrorCode, ErrorMessage, ErrorHttpStatus } from '../constants/error.constant';

/**
 * Standard error interface for application-wide error handling
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  status: number;
  timestamp: Date;
  stack?: string;
  context?: Record<string, any>;
  fingerprint?: string;
  severity?: 'error' | 'warning' | 'info';
  tags?: Record<string, string>;
}

/**
 * Creates a standardized error object with complete error context
 * @param code - Error code from ErrorCode enum
 * @param context - Optional additional error context
 * @param severity - Optional error severity level
 * @returns Standardized AppError object
 */
export const createError = (
  code: ErrorCode,
  context?: Record<string, any>,
  severity: 'error' | 'warning' | 'info' = 'error'
): AppError => {
  const error: AppError = {
    code,
    message: ErrorMessage[code],
    status: ErrorHttpStatus[code],
    timestamp: new Date(),
    severity,
  };

  // Add stack trace in development environment
  if (process.env.NODE_ENV === 'development') {
    error.stack = new Error().stack;
  }

  // Generate error fingerprint for grouping similar errors
  if (context) {
    error.fingerprint = `${code}-${JSON.stringify(context)}`;
    error.context = sanitizeContext(context);
  }

  return error;
};

/**
 * Central error handling function for processing and reporting errors
 * @param error - Error object to be handled
 * @returns Processed AppError object
 */
export const handleError = (error: Error | AppError): AppError => {
  // Convert regular Error to AppError if needed
  const appError = isAppError(error) 
    ? error 
    : createError(
        ErrorCode.NETWORK_ERROR,
        { originalError: error.message }
      );

  // Rate limiting check for similar errors
  if (!shouldReportError(appError)) {
    return appError;
  }

  // Log error with appropriate detail level
  logError(appError);

  // Report to Sentry in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: appError.tags,
      fingerprint: [appError.fingerprint || appError.code],
      level: appError.severity,
      extra: {
        code: appError.code,
        context: appError.context,
        timestamp: appError.timestamp
      }
    });
  }

  return appError;
};

/**
 * Logs errors with environment-specific detail levels
 * @param error - AppError object to be logged
 */
export const logError = (error: AppError): void => {
  const logData = {
    code: error.code,
    message: error.message,
    status: error.status,
    timestamp: error.timestamp,
    context: error.context,
    severity: error.severity
  };

  if (process.env.NODE_ENV === 'development') {
    logData['stack'] = error.stack;
    console.error('[Error]:', logData);
  } else {
    // Production logging - exclude sensitive data
    delete logData.context?.['sensitiveData'];
    // Additional production logging logic would go here
  }
};

/**
 * Type guard to validate AppError structure
 * @param error - Error object to validate
 * @returns boolean indicating if error is valid AppError
 */
export const isAppError = (error: unknown): error is AppError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const appError = error as Partial<AppError>;
  
  return (
    typeof appError.code === 'string' &&
    Object.values(ErrorCode).includes(appError.code as ErrorCode) &&
    typeof appError.message === 'string' &&
    typeof appError.status === 'number' &&
    appError.timestamp instanceof Date
  );
};

/**
 * Sanitizes error context to remove sensitive information
 * @param context - Raw error context object
 * @returns Sanitized context object
 */
const sanitizeContext = (context: Record<string, any>): Record<string, any> => {
  const sensitiveKeys = ['password', 'token', 'key', 'secret'];
  const sanitized = { ...context };

  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
};

/**
 * Checks if similar error was recently reported (rate limiting)
 * @param error - AppError to check
 * @returns boolean indicating if error should be reported
 */
const shouldReportError = (error: AppError): boolean => {
  const errorKey = `error-${error.fingerprint || error.code}`;
  const now = Date.now();
  const minReportInterval = 5000; // 5 seconds

  try {
    const lastReported = parseInt(sessionStorage.getItem(errorKey) || '0');
    if (now - lastReported < minReportInterval) {
      return false;
    }
    sessionStorage.setItem(errorKey, now.toString());
    return true;
  } catch {
    return true; // If sessionStorage is unavailable, always report
  }
};