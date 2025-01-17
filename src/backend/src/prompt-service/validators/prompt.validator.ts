import { IPrompt, IPromptVariable } from '../interfaces/prompt.interface';
import { ITemplateVariable } from '../interfaces/template.interface';
import { validateString, ValidationResult } from '../../common/utils/validation.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { validate } from 'class-validator'; // v0.14.0
import xss from 'xss'; // v1.0.14

/**
 * Enhanced validation rules for prompts with AI model compatibility
 */
export class PromptValidationRules {
  // Title constraints
  public static readonly MIN_TITLE_LENGTH = 3;
  public static readonly MAX_TITLE_LENGTH = 100;
  
  // Content constraints
  public static readonly MIN_CONTENT_LENGTH = 10;
  public static readonly MAX_CONTENT_LENGTH = 32000;
  
  // Validation patterns
  public static readonly TITLE_PATTERN = /^[a-zA-Z0-9\s\-_.,!?()]{3,100}$/;
  public static readonly VARIABLE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,30}$/;
  
  // Security patterns
  public static readonly XSS_PATTERN = /<[^>]*>|javascript:|data:|vbscript:/i;
  public static readonly SQL_INJECTION_PATTERN = /(\b(select|insert|update|delete|drop|union)\b)|(['";])/gi;
  public static readonly PROMPT_INJECTION_PATTERN = /(system:\s*override|ignore\s+previous\s+instructions|bypass\s+restrictions)/i;
  
  // Model-specific limits
  public static readonly MODEL_LIMITS = {
    'gpt-4': { maxTokens: 8000, maxLength: 24000 },
    'gpt-3.5-turbo': { maxTokens: 4000, maxLength: 12000 },
    'claude-2': { maxTokens: 100000, maxLength: 300000 }
  };
}

/**
 * Validates prompt title for length, format, and security requirements
 */
export function validatePromptTitle(title: string): ValidationResult {
  const result = new ValidationResult();
  
  // Basic validation
  if (!title?.trim()) {
    result.addError('title', 'Title is required', 'requirement');
    return result;
  }
  
  // Length validation
  if (title.length < PromptValidationRules.MIN_TITLE_LENGTH || 
      title.length > PromptValidationRules.MAX_TITLE_LENGTH) {
    result.addError(
      'title', 
      `Title must be between ${PromptValidationRules.MIN_TITLE_LENGTH} and ${PromptValidationRules.MAX_TITLE_LENGTH} characters`,
      'length'
    );
  }
  
  // Format validation
  if (!PromptValidationRules.TITLE_PATTERN.test(title)) {
    result.addError('title', 'Title contains invalid characters', 'format');
  }
  
  // Security validation
  const sanitizedTitle = xss(title, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });
  
  if (sanitizedTitle !== title) {
    result.addError('title', 'Title contains potentially unsafe content', 'security');
  }
  
  if (PromptValidationRules.SQL_INJECTION_PATTERN.test(title)) {
    result.addError('title', 'Title contains potential SQL injection patterns', 'security');
  }
  
  if (PromptValidationRules.PROMPT_INJECTION_PATTERN.test(title)) {
    result.addError('title', 'Title contains potential prompt injection patterns', 'security');
  }
  
  return result;
}

/**
 * Validates prompt content for AI model compatibility, security, and template integrity
 */
export function validatePromptContent(content: string, modelConfig: any): ValidationResult {
  const result = new ValidationResult();
  
  // Basic validation
  if (!content?.trim()) {
    result.addError('content', 'Content is required', 'requirement');
    return result;
  }
  
  // Length validation based on model
  const modelLimits = PromptValidationRules.MODEL_LIMITS[modelConfig.model] || 
                     PromptValidationRules.MODEL_LIMITS['gpt-3.5-turbo'];
  
  if (content.length > modelLimits.maxLength) {
    result.addError(
      'content',
      `Content exceeds maximum length for model ${modelConfig.model}`,
      'length'
    );
  }
  
  // Token estimation (rough approximation)
  const estimatedTokens = content.split(/\s+/).length * 1.3;
  if (estimatedTokens > modelLimits.maxTokens) {
    result.addError(
      'content',
      `Content likely exceeds maximum tokens for model ${modelConfig.model}`,
      'tokens'
    );
  }
  
  // Security validation
  const sanitizedContent = xss(content, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });
  
  if (sanitizedContent !== content) {
    result.addError('content', 'Content contains potentially unsafe HTML', 'security');
  }
  
  if (PromptValidationRules.SQL_INJECTION_PATTERN.test(content)) {
    result.addError('content', 'Content contains potential SQL injection patterns', 'security');
  }
  
  if (PromptValidationRules.PROMPT_INJECTION_PATTERN.test(content)) {
    result.addError('content', 'Content contains potential prompt injection patterns', 'security');
  }
  
  // Template variable syntax validation
  const variablePattern = /\{\{([^}]+)\}\}/g;
  const variables = content.match(variablePattern);
  if (variables) {
    const uniqueVars = new Set(variables);
    if (uniqueVars.size > 20) {
      result.addError('content', 'Too many unique variables in content', 'variables');
    }
  }
  
  return result;
}

/**
 * Validates prompt variables for correct format, types, and template compatibility
 */
export function validatePromptVariables(
  variables: IPromptVariable[],
  templateVariables: ITemplateVariable[]
): ValidationResult {
  const result = new ValidationResult();
  
  if (!Array.isArray(variables)) {
    result.addError('variables', 'Variables must be an array', 'format');
    return result;
  }
  
  // Create map of template variables for quick lookup
  const templateVarMap = new Map(
    templateVariables.map(v => [v.name, v])
  );
  
  // Track used variables for uniqueness check
  const usedVariables = new Set<string>();
  
  for (const variable of variables) {
    // Variable name validation
    if (!PromptValidationRules.VARIABLE_NAME_PATTERN.test(variable.name)) {
      result.addError(
        'variables',
        `Invalid variable name format: ${variable.name}`,
        'format'
      );
      continue;
    }
    
    // Uniqueness check
    if (usedVariables.has(variable.name)) {
      result.addError(
        'variables',
        `Duplicate variable name: ${variable.name}`,
        'uniqueness'
      );
      continue;
    }
    usedVariables.add(variable.name);
    
    // Template compatibility check
    const templateVar = templateVarMap.get(variable.name);
    if (!templateVar) {
      result.addError(
        'variables',
        `Variable not defined in template: ${variable.name}`,
        'template'
      );
      continue;
    }
    
    // Type validation
    if (variable.type !== templateVar.type) {
      result.addError(
        'variables',
        `Invalid type for variable ${variable.name}: expected ${templateVar.type}, got ${variable.type}`,
        'type'
      );
    }
    
    // Required check
    if (templateVar.required && !variable.value) {
      result.addError(
        'variables',
        `Required variable ${variable.name} has no value`,
        'requirement'
      );
    }
    
    // Value security validation
    if (typeof variable.value === 'string') {
      const sanitizedValue = xss(variable.value);
      if (sanitizedValue !== variable.value) {
        result.addError(
          'variables',
          `Variable ${variable.name} contains potentially unsafe content`,
          'security'
        );
      }
    }
  }
  
  // Check for missing required template variables
  for (const templateVar of templateVariables) {
    if (templateVar.required && !usedVariables.has(templateVar.name)) {
      result.addError(
        'variables',
        `Missing required template variable: ${templateVar.name}`,
        'requirement'
      );
    }
  }
  
  return result;
}

/**
 * Main prompt validation function that combines all validation checks
 */
export function validatePrompt(prompt: IPrompt): ValidationResult {
  const result = new ValidationResult();
  
  // Title validation
  const titleValidation = validatePromptTitle(prompt.title);
  if (!titleValidation.isValid) {
    result.errors.push(...titleValidation.errors);
  }
  
  // Content validation
  const contentValidation = validatePromptContent(prompt.content, prompt.modelConfig);
  if (!contentValidation.isValid) {
    result.errors.push(...contentValidation.errors);
  }
  
  // Variables validation
  const variablesValidation = validatePromptVariables(prompt.variables, prompt.template?.variables || []);
  if (!variablesValidation.isValid) {
    result.errors.push(...variablesValidation.errors);
  }
  
  result.isValid = result.errors.length === 0;
  return result;
}