/**
 * Error handling middleware for API Gateway
 * Provides centralized error processing with enhanced security, monitoring and PII protection
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { BaseError } from '../../common/interfaces/error.interface';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { Logger } from '../../common/utils/logger.util';

// Initialize logger for error middleware
const logger = new Logger('error-middleware', {
  maskFields: ['password', 'token', 'apiKey', 'email']
});

/**
 * Generates a unique correlation ID for error tracking
 */
const generateCorrelationId = (): string => {
  return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Masks sensitive PII data in error details
 * @param details Error details object to mask
 */
const maskSensitiveData = (details: Record<string, unknown>): Record<string, unknown> => {
  const maskedDetails = { ...details };
  const sensitiveFields = ['password', 'token', 'apiKey', 'email', 'phoneNumber'];
  
  for (const field of sensitiveFields) {
    if (field in maskedDetails) {
      maskedDetails[field] = '***REDACTED***';
    }
  }
  
  return maskedDetails;
};

/**
 * Extracts security context from request
 * @param req Express request object
 */
const extractSecurityContext = (req: Request): Record<string, unknown> => {
  return {
    userId: req.headers['x-user-id'] || 'anonymous',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    path: req.path,
    method: req.method
  };
};

/**
 * Formats error response for client
 * @param error Original error object
 * @param correlationId Error correlation ID
 */
const formatErrorResponse = (
  error: Error | BaseError,
  correlationId: string
): Record<string, unknown> => {
  // Default to internal server error if not a BaseError
  const baseError = error as BaseError;
  
  const errorResponse = {
    status: 'error',
    code: baseError.code || ErrorCode.INTERNAL_SERVER_ERROR,
    message: error.message || 'An unexpected error occurred',
    correlationId,
    timestamp: new Date().toISOString()
  };

  // Add additional context for non-production environments
  if (process.env.NODE_ENV !== 'production') {
    errorResponse['stack'] = error.stack;
    if (baseError.details) {
      errorResponse['details'] = maskSensitiveData(baseError.details);
    }
  }

  return errorResponse;
};

/**
 * Express middleware for centralized error handling
 * Processes errors and returns standardized error responses
 */
export const errorMiddleware = (
  error: Error | BaseError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID for error tracking
  const correlationId = generateCorrelationId();
  
  // Extract security context
  const securityContext = extractSecurityContext(req);
  
  // Start performance tracking
  logger.startPerformanceMetric(`error-handling-${correlationId}`);
  
  try {
    // Determine HTTP status code
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    if ('status' in error) {
      statusCode = (error as BaseError).status;
    } else if (error.name === 'ValidationError') {
      statusCode = HttpStatus.BAD_REQUEST;
    } else if (error.name === 'UnauthorizedError') {
      statusCode = HttpStatus.UNAUTHORIZED;
    }

    // Format error response
    const errorResponse = formatErrorResponse(error, correlationId);

    // Log error with context
    logger.error('API Error occurred', {
      error: {
        ...errorResponse,
        securityContext,
        originalError: error
      },
      correlationId
    });

    // End performance tracking
    logger.endPerformanceMetric(`error-handling-${correlationId}`);

    // Send error response
    res.status(statusCode).json(errorResponse);
  } catch (e) {
    // Failsafe error handling
    logger.error('Error in error handling middleware', {
      error: e,
      originalError: error,
      correlationId
    });
    
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      correlationId
    });
  } finally {
    // Ensure metric is always ended
    if (logger['performanceMetrics']?.has(`error-handling-${correlationId}`)) {
      logger.endPerformanceMetric(`error-handling-${correlationId}`);
    }
  }
};