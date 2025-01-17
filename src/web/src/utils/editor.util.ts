/**
 * @fileoverview Utility functions for managing prompt editor operations
 * @version 1.0.0
 * @package lodash ^4.17.21
 * @package dompurify ^3.0.1
 */

import { debounce } from 'lodash';
import DOMPurify from 'dompurify';
import { EDITOR_CONFIG, VARIABLE_MARKERS } from '../constants/editor.constant';
import { IPrompt, IPromptVariable } from '../interfaces/prompt.interface';

// Types and interfaces
interface IExtractedVariables {
  variables: string[];
  isValid: boolean;
  errors: string[];
}

interface IVariableMap {
  [key: string]: string | number | boolean;
}

interface IValidationOptions {
  checkAccessibility?: boolean;
  maxLength?: number;
  validateVariables?: boolean;
}

interface IValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    variableCount: number;
    contentLength: number;
    readabilityScore: number;
  };
}

// Cache for regex patterns
const variablePatternCache = new Map<string, RegExp>();

/**
 * Extracts and validates variable placeholders from prompt content
 * @param content - The prompt content to analyze
 * @returns Object containing extracted variables and validation status
 */
export const extractVariables = (content: string): IExtractedVariables => {
  const result: IExtractedVariables = {
    variables: [],
    isValid: true,
    errors: []
  };

  try {
    // Sanitize input content
    const sanitizedContent = DOMPurify.sanitize(content);

    if (!sanitizedContent) {
      result.isValid = false;
      result.errors.push('Content is empty or invalid');
      return result;
    }

    // Extract variables using regex pattern
    const matches = sanitizedContent.match(VARIABLE_MARKERS.regex) || [];
    const uniqueVariables = new Set<string>();

    for (const match of matches) {
      const variableName = match.replace(VARIABLE_MARKERS.start, '')
                               .replace(VARIABLE_MARKERS.end, '')
                               .trim();

      // Validate variable name
      if (!VARIABLE_MARKERS.validationRegex.test(variableName)) {
        result.isValid = false;
        result.errors.push(`Invalid variable name: ${variableName}`);
        continue;
      }

      uniqueVariables.add(variableName);
    }

    result.variables = Array.from(uniqueVariables);

  } catch (error) {
    result.isValid = false;
    result.errors.push(`Error extracting variables: ${error.message}`);
  }

  return result;
};

/**
 * Replaces variable placeholders with provided values
 * @param content - The prompt content containing variables
 * @param variables - Map of variable names to their values
 * @returns Object containing processed content and status
 */
export const replaceVariables = debounce((
  content: string,
  variables: IVariableMap
): { content: string; success: boolean; errors: string[] } => {
  const result = {
    content: '',
    success: true,
    errors: [] as string[]
  };

  try {
    // Sanitize input content
    let processedContent = DOMPurify.sanitize(content);

    // Extract all variables from content
    const { variables: extractedVars, isValid } = extractVariables(processedContent);

    if (!isValid) {
      result.success = false;
      result.errors.push('Invalid variable syntax in content');
      return result;
    }

    // Check for missing variables
    const missingVars = extractedVars.filter(v => !(v in variables));
    if (missingVars.length > 0) {
      result.success = false;
      result.errors.push(`Missing values for variables: ${missingVars.join(', ')}`);
      return result;
    }

    // Replace variables with their values
    extractedVars.forEach(varName => {
      const value = DOMPurify.sanitize(String(variables[varName]));
      const pattern = getVariablePattern(varName);
      processedContent = processedContent.replace(pattern, value);
    });

    result.content = processedContent;

  } catch (error) {
    result.success = false;
    result.errors.push(`Error replacing variables: ${error.message}`);
  }

  return result;
}, 250);

/**
 * Validates editor content against defined rules and constraints
 * @param content - The content to validate
 * @param options - Validation options
 * @returns Validation result with detailed feedback
 */
export const validateEditorContent = (
  content: string,
  options: IValidationOptions = {}
): IValidationResult => {
  const result: IValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    metadata: {
      variableCount: 0,
      contentLength: 0,
      readabilityScore: 0
    }
  };

  try {
    // Sanitize and prepare content
    const sanitizedContent = DOMPurify.sanitize(content);
    result.metadata.contentLength = sanitizedContent.length;

    // Check content length
    if (sanitizedContent.length > (options.maxLength || EDITOR_CONFIG.maxLength)) {
      result.isValid = false;
      result.errors.push(`Content exceeds maximum length of ${EDITOR_CONFIG.maxLength} characters`);
    }

    // Validate variables if required
    if (options.validateVariables) {
      const { variables, isValid, errors } = extractVariables(sanitizedContent);
      result.metadata.variableCount = variables.length;
      
      if (!isValid) {
        result.isValid = false;
        result.errors.push(...errors);
      }
    }

    // Check accessibility if required
    if (options.checkAccessibility) {
      const accessibilityIssues = checkAccessibility(sanitizedContent);
      if (accessibilityIssues.length > 0) {
        result.warnings.push(...accessibilityIssues);
      }
    }

    // Calculate readability score
    result.metadata.readabilityScore = calculateReadabilityScore(sanitizedContent);

  } catch (error) {
    result.isValid = false;
    result.errors.push(`Validation error: ${error.message}`);
  }

  return result;
};

// Helper functions
const getVariablePattern = (varName: string): RegExp => {
  if (!variablePatternCache.has(varName)) {
    const escapedName = varName.replace(VARIABLE_MARKERS.escapeRegex, '\\$&');
    variablePatternCache.set(
      varName,
      new RegExp(`${VARIABLE_MARKERS.start}${escapedName}${VARIABLE_MARKERS.end}`, 'g')
    );
  }
  return variablePatternCache.get(varName)!;
};

const checkAccessibility = (content: string): string[] => {
  const issues: string[] = [];
  
  // Check for potential accessibility issues
  if (content.includes('click here')) {
    issues.push('Avoid using "click here" - use descriptive link text');
  }
  
  // Add more accessibility checks as needed
  
  return issues;
};

const calculateReadabilityScore = (content: string): number => {
  // Implement readability calculation (e.g., Flesch-Kincaid)
  // This is a simplified example
  const words = content.split(/\s+/).length;
  const sentences = content.split(/[.!?]+/).length;
  return words > 0 && sentences > 0 ? (words / sentences) : 0;
};