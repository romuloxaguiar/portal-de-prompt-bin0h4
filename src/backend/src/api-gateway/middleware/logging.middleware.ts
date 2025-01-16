/**
 * API Gateway Logging Middleware
 * Provides comprehensive request/response logging with security, performance, and compliance features
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { Logger } from '../../common/utils/logger.util';
import { BaseRequest } from '../../common/interfaces/request.interface';
import { BaseResponse } from '../../common/interfaces/response.interface';

// Initialize logger instance
const logger = new Logger('API-Gateway');

// Sensitive data fields that should be masked in logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'authorization',
  'apiKey',
  'secret',
  'creditCard',
  'ssn'
];

/**
 * Masks sensitive data in objects for secure logging
 * @param data - Object containing potentially sensitive data
 * @returns Object with masked sensitive values
 */
const maskSensitiveData = (data: any): any => {
  if (!data) return data;
  
  if (typeof data === 'object') {
    const masked = { ...data };
    for (const key in masked) {
      if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
        masked[key] = '********';
      } else if (typeof masked[key] === 'object') {
        masked[key] = maskSensitiveData(masked[key]);
      }
    }
    return masked;
  }
  return data;
};

/**
 * Extracts safe headers for logging, removing sensitive information
 * @param headers - Request/response headers
 * @returns Sanitized headers object
 */
const getSafeHeaders = (headers: any): object => {
  const safeHeaders = { ...headers };
  delete safeHeaders.authorization;
  delete safeHeaders.cookie;
  return maskSensitiveData(safeHeaders);
};

/**
 * Calculates response size in bytes
 * @param res - Express response object
 * @returns Size of response in bytes
 */
const getResponseSize = (res: Response): number => {
  const sizeStr = res.getHeader('content-length');
  return sizeStr ? parseInt(sizeStr as string, 10) : 0;
};

/**
 * Express middleware for comprehensive request/response logging
 * Implements request tracking, performance monitoring, and security audit logging
 */
export const requestLoggingMiddleware = (
  req: Request & BaseRequest,
  res: Response & BaseResponse,
  next: NextFunction
): void => {
  // Generate or use existing correlation ID
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.correlationId = correlationId;

  // Record request start time
  const startTime = process.hrtime();
  
  // Calculate queue time if available
  const requestTime = new Date();
  const queueTime = req.headers['x-request-start'] 
    ? requestTime.getTime() - parseInt(req.headers['x-request-start'] as string, 10)
    : 0;

  // Log request details
  logger.http('Incoming request', {
    correlationId,
    method: req.method,
    path: req.path,
    query: maskSensitiveData(req.query),
    headers: getSafeHeaders(req.headers),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    queueTime
  });

  // Capture response using finish event
  res.on('finish', () => {
    // Calculate request duration
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000;

    // Get response details
    const status = res.statusCode;
    const size = getResponseSize(res);

    // Log response details
    logger.http('Response completed', {
      correlationId,
      method: req.method,
      path: req.path,
      status,
      duration,
      size,
      queueTime,
      headers: getSafeHeaders(res.getHeaders())
    });

    // Log security-relevant information for specific status codes
    if (status === 401 || status === 403) {
      logger.security('Security event', {
        correlationId,
        type: status === 401 ? 'authentication_failure' : 'authorization_failure',
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: (req as any).user?.id
      });
    }

    // Log performance metrics for slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        correlationId,
        method: req.method,
        path: req.path,
        duration,
        queueTime
      });
    }
  });

  // Handle errors
  res.on('error', (error: Error) => {
    logger.error('Response error', {
      correlationId,
      error: {
        message: error.message,
        stack: error.stack
      },
      method: req.method,
      path: req.path
    });
  });

  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);

  next();
};