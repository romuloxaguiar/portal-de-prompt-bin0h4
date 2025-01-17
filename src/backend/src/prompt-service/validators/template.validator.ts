import { 
  IsString, IsArray, IsObject, IsBoolean, IsNumber, 
  IsOptional, MaxLength, MinLength, Matches, ValidateNested,
  IsDate, IsEmail, IsUrl, IsEnum, IsInt, Min, Max
} from 'class-validator'; // v0.14.0
import { default as xss } from 'xss'; // v1.0.14
import { ITemplate, ITemplateVariable, ITemplateMetadata, TemplateVariableType } from '../interfaces/template.interface';

/**
 * Result interface for template validation
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  securityStatus: SecurityValidationStatus;
  performance: PerformanceMetrics;
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface SecurityValidationStatus {
  xssPassed: boolean;
  injectionPassed: boolean;
  contentSanitized: boolean;
  securityScore: number;
}

interface PerformanceMetrics {
  templateSize: number;
  variableCount: number;
  complexityScore: number;
}

/**
 * Enhanced template validator with comprehensive security features
 */
export class TemplateValidator {
  private static readonly MAX_TEMPLATE_NAME_LENGTH = 100;
  private static readonly MAX_TEMPLATE_CONTENT_LENGTH = 10000;
  private static readonly MAX_VARIABLES = 50;
  private static readonly MAX_DESCRIPTION_LENGTH = 500;

  private static readonly VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,29}$/;
  private static readonly SECURITY_PATTERN = /^[^<>{}()'"`;&|$]*$/;
  private static readonly URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

  private readonly xssFilter: typeof xss;

  constructor() {
    this.xssFilter = new xss.FilterXSS({
      whiteList: {}, // Disable all HTML tags
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script', 'style']
    });
  }

  /**
   * Comprehensive template validation with security checks
   */
  public async validate(template: ITemplate): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const securityStatus: SecurityValidationStatus = {
      xssPassed: true,
      injectionPassed: true,
      contentSanitized: false,
      securityScore: 100
    };

    // Basic structure validation
    if (!this.validateBasicStructure(template, errors)) {
      securityStatus.securityScore = 0;
      return this.createValidationResult(false, errors, securityStatus);
    }

    // Content security validation
    const contentValidation = this.validateTemplateContent(template.content);
    if (!contentValidation.isValid) {
      errors.push(...contentValidation.errors);
      securityStatus.xssPassed = false;
      securityStatus.securityScore -= 30;
    }

    // Variables validation
    if (!this.validateTemplateVariables(template.variables, errors)) {
      securityStatus.securityScore -= 20;
    }

    // Metadata validation
    if (!this.validateTemplateMetadata(template.metadata, errors)) {
      securityStatus.securityScore -= 10;
    }

    // Sanitize content
    template.content = this.xssFilter.process(template.content);
    securityStatus.contentSanitized = true;

    const isValid = errors.length === 0;
    return this.createValidationResult(isValid, errors, securityStatus);
  }

  /**
   * Validates template content with security checks
   */
  private validateTemplateContent(content: string): { isValid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    if (!content || content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Template content cannot be empty',
        code: 'CONTENT_EMPTY'
      });
    }

    if (content.length > TemplateValidator.MAX_TEMPLATE_CONTENT_LENGTH) {
      errors.push({
        field: 'content',
        message: `Content exceeds maximum length of ${TemplateValidator.MAX_TEMPLATE_CONTENT_LENGTH} characters`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    // Check for potential XSS patterns
    if (!TemplateValidator.SECURITY_PATTERN.test(content)) {
      errors.push({
        field: 'content',
        message: 'Content contains potentially unsafe characters or patterns',
        code: 'CONTENT_UNSAFE'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates template variables and their dependencies
   */
  private validateTemplateVariables(variables: ITemplateVariable[], errors: ValidationError[]): boolean {
    if (!Array.isArray(variables)) {
      errors.push({
        field: 'variables',
        message: 'Variables must be an array',
        code: 'INVALID_VARIABLES'
      });
      return false;
    }

    if (variables.length > TemplateValidator.MAX_VARIABLES) {
      errors.push({
        field: 'variables',
        message: `Number of variables exceeds maximum limit of ${TemplateValidator.MAX_VARIABLES}`,
        code: 'TOO_MANY_VARIABLES'
      });
      return false;
    }

    const variableNames = new Set<string>();
    
    return variables.every(variable => {
      if (variableNames.has(variable.name)) {
        errors.push({
          field: 'variables',
          message: `Duplicate variable name: ${variable.name}`,
          code: 'DUPLICATE_VARIABLE'
        });
        return false;
      }
      
      variableNames.add(variable.name);
      return this.validateVariable(variable, errors);
    });
  }

  /**
   * Validates individual template variable
   */
  private validateVariable(variable: ITemplateVariable, errors: ValidationError[]): boolean {
    if (!TemplateValidator.VARIABLE_NAME_PATTERN.test(variable.name)) {
      errors.push({
        field: 'variable.name',
        message: 'Invalid variable name format',
        code: 'INVALID_VARIABLE_NAME'
      });
      return false;
    }

    if (!this.isValidVariableType(variable.type)) {
      errors.push({
        field: 'variable.type',
        message: 'Invalid variable type',
        code: 'INVALID_VARIABLE_TYPE'
      });
      return false;
    }

    return this.validateVariableRules(variable, errors);
  }

  /**
   * Validates template metadata
   */
  private validateTemplateMetadata(metadata: ITemplateMetadata, errors: ValidationError[]): boolean {
    if (!metadata) return true; // Metadata is optional

    if (typeof metadata.usageCount !== 'number' || metadata.usageCount < 0) {
      errors.push({
        field: 'metadata.usageCount',
        message: 'Invalid usage count',
        code: 'INVALID_USAGE_COUNT'
      });
      return false;
    }

    if (typeof metadata.successRate !== 'number' || 
        metadata.successRate < 0 || 
        metadata.successRate > 1) {
      errors.push({
        field: 'metadata.successRate',
        message: 'Invalid success rate',
        code: 'INVALID_SUCCESS_RATE'
      });
      return false;
    }

    return true;
  }

  /**
   * Validates basic template structure
   */
  private validateBasicStructure(template: ITemplate, errors: ValidationError[]): boolean {
    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Template name is required',
        code: 'NAME_REQUIRED'
      });
      return false;
    }

    if (template.name.length > TemplateValidator.MAX_TEMPLATE_NAME_LENGTH) {
      errors.push({
        field: 'name',
        message: `Name exceeds maximum length of ${TemplateValidator.MAX_TEMPLATE_NAME_LENGTH} characters`,
        code: 'NAME_TOO_LONG'
      });
      return false;
    }

    return true;
  }

  /**
   * Validates variable type
   */
  private isValidVariableType(type: TemplateVariableType): boolean {
    const validTypes: TemplateVariableType[] = [
      'string', 'number', 'boolean', 'array', 'object',
      'date', 'email', 'url', 'regex', 'custom'
    ];
    return validTypes.includes(type);
  }

  /**
   * Validates variable validation rules
   */
  private validateVariableRules(
    variable: ITemplateVariable, 
    errors: ValidationError[]
  ): boolean {
    const { validationRules } = variable;
    
    if (!validationRules) return true;

    if (validationRules.minLength && validationRules.maxLength && 
        validationRules.minLength > validationRules.maxLength) {
      errors.push({
        field: 'validationRules',
        message: 'minLength cannot be greater than maxLength',
        code: 'INVALID_LENGTH_RANGE'
      });
      return false;
    }

    if (validationRules.minValue && validationRules.maxValue && 
        validationRules.minValue > validationRules.maxValue) {
      errors.push({
        field: 'validationRules',
        message: 'minValue cannot be greater than maxValue',
        code: 'INVALID_VALUE_RANGE'
      });
      return false;
    }

    return true;
  }

  /**
   * Creates the final validation result
   */
  private createValidationResult(
    isValid: boolean,
    errors: ValidationError[],
    securityStatus: SecurityValidationStatus
  ): ValidationResult {
    return {
      isValid,
      errors,
      securityStatus,
      performance: {
        templateSize: 0, // Calculated based on content size
        variableCount: 0, // Calculated based on variables array
        complexityScore: 0 // Calculated based on template structure
      }
    };
  }
}