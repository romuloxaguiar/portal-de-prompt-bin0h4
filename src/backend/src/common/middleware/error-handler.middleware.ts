/**
 * Enhanced error handling middleware for the Prompts Portal application
 * Provides centralized error processing with security, monitoring and observability features
 * @version 1.0.0
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express'; // v4.18.0
import { BaseError } from '../interfaces/error.interface';
import { HttpStatus } from '../constants/http-status.constant';
import { ErrorCode } from '../constants/error-codes.constant';
import { Logger } from '../utils/logger.util';

// Initialize logger for error handler
const logger = new Logger('ErrorHandler');

// Cache for tracking error rates per client/IP
const ERROR_CACHE = new Map<string, { count: number; timestamp: number }>();

/**
 * Sanitizes error details to prevent sensitive data exposure
 * @param error - Error object to sanitize
 */
const sanitizeError = (error: Error | BaseError): Partial<BaseError> => {
  // For production, limit error details exposed to clients
  const sanitized: Partial<BaseError> = {
    message: error.message,
    code: (error as BaseError).code || ErrorCode.INTERNAL_SERVER_ERROR,
    status: (error as BaseError).status || HttpStatus.INTERNAL_SERVER_ERROR
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    sanitized.details = {
      stack: error.stack,
      ...(error as BaseError).details
    };
  }

  return sanitized;
};

/**
 * Generates or extracts correlation ID for request tracking
 * @param req - Express request object
 */
const getCorrelationId = (req: Request): string => {
  return req.headers['x-correlation-id'] as string || 
         req.headers['x-request-id'] as string || 
         Math.random().toString(36).substring(2, 15);
};

/**
 * Tracks error rates per client to prevent abuse
 * @param clientId - Client identifier (IP or user ID)
 * @returns boolean indicating if rate limit exceeded
 */
const checkErrorRateLimit = (clientId: string): boolean => {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxErrors = 10; // Max errors per window

  const clientErrors = ERROR_CACHE.get(clientId) || { count: 0, timestamp: now };

  // Reset counter if window expired
  if (now - clientErrors.timestamp > windowMs) {
    clientErrors.count = 1;
    clientErrors.timestamp = now;
  } else {
    clientErrors.count++;
  }

  ERROR_CACHE.set(clientId, clientErrors);

  // Clean up old entries periodically
  if (ERROR_CACHE.size > 10000) {
    for (const [key, value] of ERROR_CACHE.entries()) {
      if (now - value.timestamp > windowMs) {
        ERROR_CACHE.delete(key);
      }
    }
  }

  return clientErrors.count > maxErrors;
};

/**
 * Enhanced error handling middleware
 * Processes errors with security features and detailed logging
 */
const errorHandler: ErrorRequestHandler = (
  error: Error | BaseError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Start performance measurement
  logger.startPerformanceMetric('error-processing');

  // Generate correlation ID for request tracking
  const correlationId = getCorrelationId(req);

  // Check rate limiting
  const clientId = req.ip || req.user?.id || 'anonymous';
  if (checkErrorRateLimit(clientId)) {
    logger.warn('Error rate limit exceeded', { clientId, correlationId });
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      status: 'error',
      code: ErrorCode.RATE_LIMIT_ERROR,
      message: 'Too many errors, please try again later'
    });
    return;
  }

  // Determine error type and extract details
  let errorResponse: Partial<BaseError>;

  if (error instanceof Error) {
    // Map standard Error object to BaseError format
    errorResponse = {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: error.message,
      details: { stack: error.stack }
    };
  } else {
    // Use BaseError properties directly
    errorResponse = error;
  }

  // Sanitize error details
  const sanitizedError = sanitizeError(error);

  // Log error with enhanced context
  logger.error('Request error occurred', {
    error: sanitizedError,
    correlationId,
    request: {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for']
      }
    }
  });

  // End performance measurement
  logger.endPerformanceMetric('error-processing');

  // Send error response
  res.status(sanitizedError.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
    status: 'error',
    code: sanitizedError.code,
    message: sanitizedError.message,
    correlationId,
    timestamp: new Date().toISOString(),
    ...(sanitizedError.details && { details: sanitizedError.details })
  });
};

export default errorHandler;