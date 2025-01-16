/**
 * @fileoverview Centralized validation utilities for the Prompts Portal application.
 * Provides comprehensive input validation, data sanitization, and standardized error handling.
 * 
 * @version 1.0.0
 */

import validator from 'validator'; // v13.9.0
import { validate, ValidationError as ClassValidatorError } from 'class-validator'; // v0.14.0
import { ValidationError } from '../interfaces/error.interface';
import { ErrorCode } from '../constants/error-codes.constant';

/**
 * Validation metrics for tracking and monitoring validation operations
 */
interface ValidationMetrics {
  timestamp: Date;
  duration: number;
  totalChecks: number;
  failedChecks: number;
  category: string;
}

/**
 * Options for string validation
 */
interface ValidationOptions {
  minLength?: number;
  maxLength?: number;
  allowedCharacters?: RegExp;
  required?: boolean;
  customValidators?: ((input: string) => boolean)[];
}

/**
 * Options for prompt validation
 */
interface PromptValidationRules {
  maxTokens: number;
  allowedVariables: RegExp;
  prohibitedPatterns: RegExp[];
  modelSpecificRules?: Record<string, unknown>;
}

/**
 * Options for input sanitization
 */
interface SanitizationOptions {
  stripHtml?: boolean;
  normalizeWhitespace?: boolean;
  removeScriptTags?: boolean;
  encodeSpecialChars?: boolean;
}

/**
 * Class representing the result of a validation operation
 */
export class ValidationResult {
  public readonly timestamp: Date;
  public isValid: boolean;
  public errors: Array<{ field: string; message: string; category: string }>;
  public metrics: ValidationMetrics;

  constructor(isValid: boolean = true) {
    this.timestamp = new Date();
    this.isValid = isValid;
    this.errors = [];
    this.metrics = {
      timestamp: new Date(),
      duration: 0,
      totalChecks: 0,
      failedChecks: 0,
      category: 'general'
    };
  }

  /**
   * Adds a validation error with categorization
   */
  public addError(field: string, message: string, category: string = 'general'): void {
    this.errors.push({ field, message, category });
    this.isValid = false;
    this.metrics.failedChecks++;
  }

  /**
   * Updates validation metrics
   */
  public updateMetrics(checks: number, duration: number, category: string): void {
    this.metrics.totalChecks = checks;
    this.metrics.duration = duration;
    this.metrics.category = category;
  }
}

/**
 * Validates string input against security threats and format requirements
 */
export function validateString(input: string, options: ValidationOptions = {}): ValidationResult {
  const startTime = Date.now();
  const result = new ValidationResult();
  let checks = 0;

  // Required check
  if (options.required && !input) {
    result.addError('input', 'Input is required', 'requirement');
    return result;
  }

  if (!input && !options.required) {
    return result;
  }

  // Length validation
  checks++;
  if (options.minLength && input.length < options.minLength) {
    result.addError('input', `Input must be at least ${options.minLength} characters`, 'length');
  }

  checks++;
  if (options.maxLength && input.length > options.maxLength) {
    result.addError('input', `Input cannot exceed ${options.maxLength} characters`, 'length');
  }

  // XSS prevention checks
  checks++;
  if (/<script\b[^>]*>[\s\S]*?<\/script>/gi.test(input)) {
    result.addError('input', 'Input contains potentially malicious script tags', 'security');
  }

  // SQL injection prevention
  checks++;
  if (/(\b(select|insert|update|delete|drop|union)\b)/gi.test(input)) {
    result.addError('input', 'Input contains potential SQL injection patterns', 'security');
  }

  // Character set validation
  checks++;
  if (options.allowedCharacters && !options.allowedCharacters.test(input)) {
    result.addError('input', 'Input contains invalid characters', 'format');
  }

  // Custom validators
  if (options.customValidators) {
    options.customValidators.forEach(validatorFn => {
      checks++;
      if (!validatorFn(input)) {
        result.addError('input', 'Input failed custom validation', 'custom');
      }
    });
  }

  result.updateMetrics(checks, Date.now() - startTime, 'string');
  return result;
}

/**
 * Validates prompt content for AI model compatibility and security
 */
export function validatePrompt(promptContent: string, rules: PromptValidationRules): ValidationResult {
  const startTime = Date.now();
  const result = new ValidationResult();
  let checks = 0;

  // Token length validation
  checks++;
  const estimatedTokens = promptContent.split(/\s+/).length;
  if (estimatedTokens > rules.maxTokens) {
    result.addError('prompt', `Prompt exceeds maximum token limit of ${rules.maxTokens}`, 'length');
  }

  // Variable syntax validation
  checks++;
  const variablePattern = rules.allowedVariables;
  const variables = promptContent.match(variablePattern);
  if (variables) {
    const uniqueVars = new Set(variables);
    if (uniqueVars.size > 10) {
      result.addError('prompt', 'Too many unique variables in prompt', 'variables');
    }
  }

  // Prohibited patterns check
  rules.prohibitedPatterns.forEach(pattern => {
    checks++;
    if (pattern.test(promptContent)) {
      result.addError('prompt', 'Prompt contains prohibited content patterns', 'content');
    }
  });

  // Prompt injection prevention
  checks++;
  const injectionPatterns = [
    /system:\s*override/i,
    /ignore\s+previous\s+instructions/i,
    /bypass\s+restrictions/i
  ];
  
  injectionPatterns.forEach(pattern => {
    if (pattern.test(promptContent)) {
      result.addError('prompt', 'Potential prompt injection detected', 'security');
    }
  });

  result.updateMetrics(checks, Date.now() - startTime, 'prompt');
  return result;
}

/**
 * Sanitizes input strings to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string, options: SanitizationOptions = {}): string {
  if (!input) return '';

  let sanitized = input;

  // Strip HTML if enabled
  if (options.stripHtml) {
    sanitized = validator.stripLow(sanitized);
    sanitized = validator.escape(sanitized);
  }

  // Remove script tags
  if (options.removeScriptTags) {
    sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  // Normalize whitespace
  if (options.normalizeWhitespace) {
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
  }

  // Encode special characters
  if (options.encodeSpecialChars) {
    sanitized = validator.escape(sanitized);
  }

  // Additional security measures
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '');

  return sanitized;
}

/**
 * Creates a validation error response
 */
export function createValidationError(errors: Array<{ field: string; message: string }>): ValidationError {
  return {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Validation failed',
    validationErrors: errors,
    timestamp: new Date(),
    status: 400
  };
}