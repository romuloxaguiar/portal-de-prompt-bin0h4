/**
 * @fileoverview Enhanced validation middleware for API Gateway with performance optimization
 * and comprehensive security features. Provides centralized request validation,
 * schema validation, and detailed error tracking.
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'; // v4.18.2
import { validate, ValidationError as ClassValidatorError } from 'class-validator'; // v0.14.0
import { plainToClass } from 'class-transformer'; // v0.5.1
import {
  validateString,
  validatePrompt,
  sanitizeInput,
  ValidationResult
} from '../../common/utils/validation.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ValidationError } from '../../common/interfaces/error.interface';

/**
 * Cache interface for validation rules to optimize performance
 */
interface ValidationCache {
  rules: Map<string, object>;
  timestamp: Date;
  hits: number;
  misses: number;
}

/**
 * Enhanced validation context for tracking and monitoring
 */
interface ValidationContext {
  startTime: number;
  validationCount: number;
  errors: ValidationError[];
  metrics: {
    duration: number;
    cacheMissRate: number;
    errorRate: number;
  };
}

/**
 * Enhanced validation middleware class with performance optimization
 * and comprehensive security features
 */
export class ValidationMiddleware {
  private static validationCache: ValidationCache = {
    rules: new Map(),
    timestamp: new Date(),
    hits: 0,
    misses: 0
  };

  private static context: ValidationContext = {
    startTime: 0,
    validationCount: 0,
    errors: [],
    metrics: {
      duration: 0,
      cacheMissRate: 0,
      errorRate: 0
    }
  };

  /**
   * Creates an enhanced validation middleware with caching and performance tracking
   */
  public static validate(schema: any, options: any = {}): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        this.context.startTime = Date.now();
        this.context.validationCount = 0;
        this.context.errors = [];

        // Transform request data using class-transformer
        const transformedData = plainToClass(schema, {
          ...req.body,
          ...req.query,
          ...req.params
        });

        // Check validation cache for performance optimization
        const cacheKey = `${schema.name}-${JSON.stringify(options)}`;
        let validationRules = this.validationCache.rules.get(cacheKey);

        if (!validationRules) {
          this.validationCache.misses++;
          validationRules = await validate(transformedData, {
            whitelist: true,
            forbidNonWhitelisted: true,
            ...options
          });
          this.validationCache.rules.set(cacheKey, validationRules);
        } else {
          this.validationCache.hits++;
        }

        // Perform enhanced validation with security checks
        const errors = await validate(transformedData, validationRules as any);
        this.context.validationCount++;

        if (errors.length > 0) {
          const validationErrors = this.formatValidationErrors(errors);
          this.updateMetrics();

          return res.status(HttpStatus.BAD_REQUEST).json({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            validationErrors,
            timestamp: new Date(),
            metrics: this.context.metrics
          });
        }

        // Sanitize validated data
        req.body = this.sanitizeRequestData(transformedData);

        this.updateMetrics();
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Formats validation errors with detailed information
   */
  private static formatValidationErrors(errors: ClassValidatorError[]): Array<{ field: string; message: string }> {
    return errors.map(error => ({
      field: error.property,
      message: Object.values(error.constraints || {}).join(', ')
    }));
  }

  /**
   * Sanitizes request data recursively with enhanced security
   */
  private static sanitizeRequestData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return typeof data === 'string' ? sanitizeInput(data, {
        stripHtml: true,
        normalizeWhitespace: true,
        removeScriptTags: true,
        encodeSpecialChars: true
      }) : data;
    }

    const sanitized: any = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = this.sanitizeRequestData(value);
    }

    return sanitized;
  }

  /**
   * Updates validation metrics for monitoring
   */
  private static updateMetrics(): void {
    const totalCacheRequests = this.validationCache.hits + this.validationCache.misses;
    
    this.context.metrics = {
      duration: Date.now() - this.context.startTime,
      cacheMissRate: totalCacheRequests > 0 ? 
        this.validationCache.misses / totalCacheRequests : 0,
      errorRate: this.context.validationCount > 0 ? 
        this.context.errors.length / this.context.validationCount : 0
    };
  }
}

/**
 * Enhanced request validation middleware with security features
 */
export const validateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startTime = Date.now();
    let isValid = true;
    const errors: Array<{ field: string; message: string }> = [];

    // Validate request body
    if (req.body) {
      const bodyValidation = new ValidationResult();
      
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          const result = validateString(value, {
            maxLength: 5000,
            required: true,
            allowedCharacters: /^[\w\s\-_.@/]+$/
          });
          
          if (!result.isValid) {
            isValid = false;
            errors.push(...result.errors.map(err => ({
              field: `body.${key}`,
              message: err.message
            })));
          }
        }
      }
    }

    // Validate prompt content if present
    if (req.body?.promptContent) {
      const promptValidation = validatePrompt(req.body.promptContent, {
        maxTokens: 4000,
        allowedVariables: /\{\{[\w\-_.]+\}\}/g,
        prohibitedPatterns: [
          /<script\b[^>]*>[\s\S]*?<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi
        ]
      });

      if (!promptValidation.isValid) {
        isValid = false;
        errors.push(...promptValidation.errors.map(err => ({
          field: 'promptContent',
          message: err.message
        })));
      }
    }

    if (!isValid) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed',
        validationErrors: errors,
        timestamp: new Date(),
        metrics: {
          duration: Date.now() - startTime,
          totalChecks: errors.length
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Enhanced schema validation middleware factory with caching
 */
export const validateSchema = (schema: any, options: any = {}): RequestHandler => {
  return ValidationMiddleware.validate(schema, options);
};