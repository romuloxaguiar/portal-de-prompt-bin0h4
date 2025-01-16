/**
 * Request Validator Middleware
 * 
 * Provides comprehensive request validation and sanitization for all incoming API requests.
 * Implements configurable validation schemas, custom validation rules, and detailed error reporting.
 * 
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { validate, ValidationError as ClassValidatorError } from 'class-validator'; // v0.14.0
import { BaseRequest } from '../interfaces/request.interface';
import { ValidationError } from '../interfaces/error.interface';
import { validateString, sanitizeInput } from '../utils/validation.util';
import { ErrorCode } from '../constants/error-codes.constant';
import { HttpStatus } from '../constants/http-status.constant';

/**
 * Interface for validation rule configuration
 */
interface ValidationRule {
  validate: (value: unknown) => boolean;
  message: string;
  category: string;
}

/**
 * Interface for validation schema configuration
 */
interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: ValidationRule[];
  };
}

/**
 * Cache interface for validation results
 */
interface ValidationCache {
  result: boolean;
  errors: Array<{ field: string; message: string; category: string }>;
  timestamp: Date;
  ttl: number;
}

/**
 * Enhanced request validation middleware class with configurable schemas and custom rules
 */
export class RequestValidator {
  private readonly validationSchema?: ValidationSchema;
  private readonly customRules: Map<string, ValidationRule[]>;
  private readonly validationCache: Map<string, ValidationCache>;
  private readonly cacheTTL: number = 300000; // 5 minutes

  /**
   * Initializes request validator with schema and custom rules
   */
  constructor(schema?: ValidationSchema, customRules?: Map<string, ValidationRule[]>) {
    this.validationSchema = schema;
    this.customRules = customRules || new Map();
    this.validationCache = new Map();
  }

  /**
   * Express middleware for enhanced request validation
   */
  public validate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const cacheKey = this.generateCacheKey(req);
      const cachedResult = this.getCachedValidation(cacheKey);
      
      if (cachedResult) {
        if (cachedResult.errors.length > 0) {
          throw this.createValidationError(cachedResult.errors);
        }
        return next();
      }

      const validationErrors: Array<{ field: string; message: string; category: string }> = [];

      // Validate against BaseRequest interface
      if (!this.validateBaseRequest(req)) {
        validationErrors.push({
          field: 'request',
          message: 'Request does not meet base requirements',
          category: 'structure'
        });
      }

      // Schema validation
      if (this.validationSchema) {
        const schemaErrors = await this.validateSchema(req.body);
        validationErrors.push(...schemaErrors);
      }

      // Custom rules validation
      const customErrors = this.validateCustomRules(req);
      validationErrors.push(...customErrors);

      // Deep object validation and sanitization
      const sanitizationErrors = this.validateAndSanitizeDeep(req.body);
      validationErrors.push(...sanitizationErrors);

      // Cache validation result
      this.cacheValidationResult(cacheKey, {
        result: validationErrors.length === 0,
        errors: validationErrors,
        timestamp: new Date(),
        ttl: this.cacheTTL
      });

      if (validationErrors.length > 0) {
        throw this.createValidationError(validationErrors);
      }

      next();
    } catch (error) {
      if (error instanceof Error) {
        res.status(HttpStatus.BAD_REQUEST).json(error);
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Validation processing error',
          timestamp: new Date()
        });
      }
    }
  };

  /**
   * Adds a custom validation rule
   */
  public addCustomRule(field: string, rule: ValidationRule): void {
    const rules = this.customRules.get(field) || [];
    rules.push(rule);
    this.customRules.set(field, rules);
  }

  /**
   * Validates request against BaseRequest interface
   */
  private validateBaseRequest(req: Request): boolean {
    const baseRequest = req.body as BaseRequest;
    return (
      typeof baseRequest.id === 'string' &&
      baseRequest.id.length > 0 &&
      baseRequest.timestamp instanceof Date &&
      typeof baseRequest.correlationId === 'string' &&
      baseRequest.correlationId.length > 0
    );
  }

  /**
   * Validates request body against schema
   */
  private async validateSchema(
    body: unknown
  ): Promise<Array<{ field: string; message: string; category: string }>> {
    const errors: Array<{ field: string; message: string; category: string }> = [];

    if (!this.validationSchema || !body) {
      return errors;
    }

    for (const [field, rules] of Object.entries(this.validationSchema)) {
      const value = (body as any)[field];

      if (rules.required && (value === undefined || value === null)) {
        errors.push({
          field,
          message: `${field} is required`,
          category: 'required'
        });
        continue;
      }

      if (value !== undefined && value !== null) {
        const validationResult = validateString(String(value), {
          minLength: rules.minLength,
          maxLength: rules.maxLength,
          allowedCharacters: rules.pattern,
          required: rules.required
        });

        if (!validationResult.isValid) {
          errors.push(...validationResult.errors);
        }
      }
    }

    return errors;
  }

  /**
   * Validates request against custom rules
   */
  private validateCustomRules(
    req: Request
  ): Array<{ field: string; message: string; category: string }> {
    const errors: Array<{ field: string; message: string; category: string }> = [];

    for (const [field, rules] of this.customRules.entries()) {
      const value = (req.body as any)[field];

      for (const rule of rules) {
        if (!rule.validate(value)) {
          errors.push({
            field,
            message: rule.message,
            category: rule.category
          });
        }
      }
    }

    return errors;
  }

  /**
   * Recursively validates and sanitizes nested objects
   */
  private validateAndSanitizeDeep(
    obj: unknown
  ): Array<{ field: string; message: string; category: string }> {
    const errors: Array<{ field: string; message: string; category: string }> = [];

    if (typeof obj !== 'object' || obj === null) {
      return errors;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const sanitized = sanitizeInput(value, {
          stripHtml: true,
          normalizeWhitespace: true,
          removeScriptTags: true,
          encodeSpecialChars: true
        });
        (obj as any)[key] = sanitized;

        if (sanitized !== value) {
          errors.push({
            field: key,
            message: 'Input contained potentially malicious content',
            category: 'security'
          });
        }
      } else if (typeof value === 'object' && value !== null) {
        errors.push(...this.validateAndSanitizeDeep(value));
      }
    }

    return errors;
  }

  /**
   * Generates cache key for validation results
   */
  private generateCacheKey(req: Request): string {
    return `${req.method}-${req.path}-${JSON.stringify(req.body)}`;
  }

  /**
   * Retrieves cached validation result
   */
  private getCachedValidation(key: string): ValidationCache | null {
    const cached = this.validationCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp.getTime() > cached.ttl) {
      this.validationCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Caches validation result
   */
  private cacheValidationResult(key: string, result: ValidationCache): void {
    this.validationCache.set(key, result);
  }

  /**
   * Creates validation error response
   */
  private createValidationError(
    errors: Array<{ field: string; message: string; category: string }>
  ): ValidationError {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      status: HttpStatus.BAD_REQUEST,
      timestamp: new Date(),
      validationErrors: errors
    };
  }
}