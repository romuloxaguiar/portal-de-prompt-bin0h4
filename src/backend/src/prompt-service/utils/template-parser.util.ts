/**
 * @fileoverview Advanced utility module for secure template parsing and validation
 * with comprehensive security measures and variable substitution capabilities.
 * 
 * @version 1.0.0
 */

import { ITemplate, TemplateVariableType } from '../interfaces/template.interface';
import { validateString, ValidationResult } from '../../common/utils/validation.util';
import { get, template, escapeRegExp } from 'lodash'; // v4.17.21

/**
 * Security levels for template validation
 */
export enum SecurityLevel {
  BASIC = 'basic',
  STRICT = 'strict',
  ENTERPRISE = 'enterprise'
}

/**
 * Configuration for content sanitization
 */
export interface SanitizationConfig {
  stripHtml: boolean;
  normalizeWhitespace: boolean;
  removeScriptTags: boolean;
  encodeSpecialChars: boolean;
}

/**
 * Enhanced interface for template validation options
 */
export interface ITemplateValidationOptions {
  strictMode: boolean;
  maxLength: number;
  allowedVariableTypes: TemplateVariableType[];
  securityLevel: SecurityLevel;
  sanitizationRules: SanitizationConfig;
  maxRecursionDepth: number;
}

/**
 * Comprehensive interface for template parsing results
 */
export interface ITemplateParseResult {
  processedContent: string;
  missingVariables: string[];
  invalidVariables: Array<{ name: string; error: string }>;
  securityWarnings: Array<{ type: string; message: string }>;
  processingMetrics: {
    duration: number;
    complexity: number;
  };
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: ITemplateValidationOptions = {
  strictMode: true,
  maxLength: 10000,
  allowedVariableTypes: ['string', 'number', 'boolean', 'date'],
  securityLevel: SecurityLevel.STRICT,
  sanitizationRules: {
    stripHtml: true,
    normalizeWhitespace: true,
    removeScriptTags: true,
    encodeSpecialChars: true
  },
  maxRecursionDepth: 3
};

/**
 * Security patterns for detecting potential template injection attacks
 */
const SECURITY_PATTERNS = {
  injectionAttempts: [
    /\{\{.*\}\}/g,
    /<\%.*\%>/g,
    /\$\{.*\}/g
  ],
  dangerousCommands: [
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /system\s*\(/gi
  ],
  sensitiveData: [
    /password/gi,
    /secret/gi,
    /token/gi,
    /key/gi
  ]
};

/**
 * Validates template variables against provided values with enhanced security checks
 */
export function validateTemplateVariables(
  templateVariables: ITemplate['variables'],
  providedVariables: Record<string, any>,
  options: Partial<ITemplateValidationOptions> = {}
): ValidationResult {
  const startTime = Date.now();
  const validationOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  const result = new ValidationResult();
  let checks = 0;

  // Validate required variables
  templateVariables.forEach(variable => {
    checks++;
    const value = providedVariables[variable.name];

    if (variable.required && (value === undefined || value === null)) {
      result.addError(
        variable.name,
        `Required variable "${variable.name}" is missing`,
        'requirement'
      );
      return;
    }

    if (value !== undefined && value !== null) {
      // Type validation
      checks++;
      if (!validationOptions.allowedVariableTypes.includes(variable.type)) {
        result.addError(
          variable.name,
          `Variable type "${variable.type}" is not allowed`,
          'type'
        );
        return;
      }

      // Value validation based on type and rules
      const validationRules = variable.validationRules;
      if (validationRules) {
        checks++;
        switch (variable.type) {
          case 'string':
            const stringResult = validateString(String(value), {
              minLength: validationRules.minLength,
              maxLength: validationRules.maxLength,
              allowedCharacters: validationRules.pattern ? new RegExp(validationRules.pattern) : undefined
            });
            if (!stringResult.isValid) {
              stringResult.errors.forEach(error => {
                result.addError(variable.name, error.message, 'validation');
              });
            }
            break;

          case 'number':
            if (validationRules.minValue !== undefined && value < validationRules.minValue) {
              result.addError(
                variable.name,
                `Value must be greater than or equal to ${validationRules.minValue}`,
                'validation'
              );
            }
            if (validationRules.maxValue !== undefined && value > validationRules.maxValue) {
              result.addError(
                variable.name,
                `Value must be less than or equal to ${validationRules.maxValue}`,
                'validation'
              );
            }
            break;

          // Add additional type validations as needed
        }
      }
    }
  });

  result.updateMetrics(checks, Date.now() - startTime, 'variable-validation');
  return result;
}

/**
 * Securely parses a template and substitutes variables with comprehensive validation
 */
export async function parseTemplate(
  template: ITemplate,
  variables: Record<string, any>,
  options: Partial<ITemplateValidationOptions> = {}
): Promise<ITemplateParseResult> {
  const startTime = Date.now();
  const parseOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  const result: ITemplateParseResult = {
    processedContent: '',
    missingVariables: [],
    invalidVariables: [],
    securityWarnings: [],
    processingMetrics: {
      duration: 0,
      complexity: 0
    }
  };

  // Validate template structure
  if (!template.content || typeof template.content !== 'string') {
    throw new Error('Invalid template content');
  }

  // Security scan for potential injection patterns
  SECURITY_PATTERNS.injectionAttempts.forEach(pattern => {
    if (pattern.test(template.content)) {
      result.securityWarnings.push({
        type: 'injection',
        message: 'Potential template injection pattern detected'
      });
    }
  });

  // Validate variables
  const variableValidation = validateTemplateVariables(
    template.variables,
    variables,
    parseOptions
  );

  if (!variableValidation.isValid) {
    variableValidation.errors.forEach(error => {
      result.invalidVariables.push({
        name: error.field,
        error: error.message
      });
    });
  }

  // Process template content
  let processedContent = template.content;
  const complexity = template.variables.length;

  // Variable substitution with security checks
  template.variables.forEach(variable => {
    const value = variables[variable.name];
    if (value === undefined || value === null) {
      result.missingVariables.push(variable.name);
      return;
    }

    // Sanitize variable value based on security level
    let sanitizedValue = String(value);
    if (parseOptions.securityLevel === SecurityLevel.ENTERPRISE) {
      sanitizedValue = sanitizedValue
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/['"`]/g, '') // Remove quotes to prevent injection
        .slice(0, parseOptions.maxLength); // Enforce length limit
    }

    // Replace variable placeholder with sanitized value
    const placeholder = new RegExp(`\\{${escapeRegExp(variable.name)}\\}`, 'g');
    processedContent = processedContent.replace(placeholder, sanitizedValue);
  });

  // Apply final sanitization rules
  if (parseOptions.sanitizationRules.normalizeWhitespace) {
    processedContent = processedContent.replace(/\s+/g, ' ').trim();
  }

  result.processedContent = processedContent;
  result.processingMetrics = {
    duration: Date.now() - startTime,
    complexity
  };

  return result;
}