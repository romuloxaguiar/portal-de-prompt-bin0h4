/**
 * @fileoverview Utility functions for prompt manipulation, transformation, and optimization
 * @version 1.0.0
 * @package lodash ^4.17.21
 */

import { cloneDeep } from 'lodash'; // v4.17.21
import { IPrompt } from '../interfaces/prompt.interface';
import { validatePrompt } from './validation.util';

// Cache for variable extraction results
const variableExtractionCache = new Map<string, string[]>();

/**
 * Interface for variable validation results with enhanced error reporting
 */
interface ValidationResult {
  isValid: boolean;
  missingVariables: string[];
  validationErrors: Record<string, string>;
}

/**
 * Extracts and validates variable placeholders from prompt content with enhanced regex and caching
 * @param content - The prompt content to extract variables from
 * @returns Array of validated variable names found in content
 */
export const extractVariables = (content: string): string[] => {
  if (!content) {
    return [];
  }

  // Check cache first
  const cachedResult = variableExtractionCache.get(content);
  if (cachedResult) {
    return [...cachedResult];
  }

  // Extract variables using optimized regex
  const variableRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const matches = content.matchAll(variableRegex);
  const variables = Array.from(matches, match => match[1]);

  // Remove duplicates using Set
  const uniqueVariables = [...new Set(variables)];

  // Validate variable names
  const validVariables = uniqueVariables.filter(variable => {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable);
  });

  // Cache the results
  variableExtractionCache.set(content, validVariables);

  return validVariables;
};

/**
 * Replaces variable placeholders with type-checked values, including nested support
 * @param content - The prompt content containing variables
 * @param variables - Object containing variable values
 * @returns Content with variables safely replaced with values
 */
export const interpolateVariables = (
  content: string,
  variables: Record<string, any>
): string => {
  if (!content || !variables) {
    return content || '';
  }

  // Extract all variables from content
  const requiredVariables = extractVariables(content);

  // Create sanitized interpolation map
  const interpolationMap = new Map<string, string>();
  
  for (const varName of requiredVariables) {
    const value = variables[varName];
    
    // Skip undefined variables
    if (value === undefined) {
      continue;
    }

    // Sanitize and convert value to string
    let sanitizedValue: string;
    if (typeof value === 'object') {
      sanitizedValue = JSON.stringify(value)
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
    } else {
      sanitizedValue = String(value)
        .replace(/[<>]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
    }

    interpolationMap.set(varName, sanitizedValue);
  }

  // Perform interpolation
  return content.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, varName) => {
    return interpolationMap.get(varName) || match;
  });
};

/**
 * Formats prompt content with enhanced text normalization and security checks
 * @param content - The prompt content to format
 * @returns Normalized and formatted prompt content
 */
export const formatPromptContent = (content: string): string => {
  if (!content) {
    return '';
  }

  return content
    // Normalize Unicode characters
    .normalize('NFKC')
    // Standardize line endings
    .replace(/\r\n/g, '\n')
    // Remove duplicate whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    // Trim whitespace
    .trim();
};

/**
 * Comprehensive validation of variables with enhanced error reporting
 * @param content - The prompt content to validate
 * @param variables - Object containing variable values
 * @returns Detailed validation results with error information
 */
export const validateVariables = (
  content: string,
  variables: Record<string, any>
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    missingVariables: [],
    validationErrors: {}
  };

  if (!content) {
    result.isValid = false;
    result.validationErrors.content = 'Content is required';
    return result;
  }

  // Extract required variables
  const requiredVariables = extractVariables(content);

  // Check for missing variables
  for (const varName of requiredVariables) {
    if (!(varName in variables)) {
      result.isValid = false;
      result.missingVariables.push(varName);
      result.validationErrors[varName] = 'Variable is required but not provided';
    }
  }

  // Validate variable values
  for (const [varName, value] of Object.entries(variables)) {
    // Check if variable is used in content
    if (!requiredVariables.includes(varName)) {
      result.validationErrors[varName] = 'Variable is provided but not used in content';
    }

    // Validate value type
    if (value !== null && value !== undefined) {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        result.isValid = false;
        result.validationErrors[varName] = 'Invalid variable type';
      }
    }
  }

  return result;
};

/**
 * Creates a deep clone of a prompt with enhanced metadata handling
 * @param prompt - The prompt object to clone
 * @returns Fully cloned prompt object with new metadata
 */
export const clonePrompt = async (prompt: IPrompt): Promise<IPrompt> => {
  if (!prompt) {
    throw new Error('Prompt object is required');
  }

  // Validate source prompt
  await validatePrompt(prompt);

  // Create deep clone
  const clonedPrompt: IPrompt = cloneDeep(prompt);

  // Generate new ID (assuming UUID v4 format)
  clonedPrompt.id = crypto.randomUUID();

  // Reset version history
  clonedPrompt.currentVersion = {
    id: crypto.randomUUID(),
    content: prompt.content,
    changes: {
      description: 'Initial version of cloned prompt',
      author: prompt.creatorId,
      timestamp: new Date()
    }
  };

  // Update timestamps
  clonedPrompt.createdAt = new Date();
  clonedPrompt.updatedAt = new Date();

  // Initialize metadata
  clonedPrompt.metadata = {
    usageCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    aiModel: prompt.metadata.aiModel,
    averageResponseTime: 0,
    totalTokens: 0,
    costEstimate: 0
  };

  return clonedPrompt;
};