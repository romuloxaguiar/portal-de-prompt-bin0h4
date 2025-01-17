/**
 * @fileoverview Validation utilities for frontend data structures with comprehensive security measures
 * @version 1.0.0
 * @package yup ^1.3.0
 */

import * as yup from 'yup';
import { IPrompt } from '../interfaces/prompt.interface';
import { IAuthUser } from '../interfaces/auth.interface';
import { WorkspaceCreatePayload } from '../interfaces/workspace.interface';

// Constants for validation rules
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_PROMPT_TITLE_LENGTH = 100;
const MAX_PROMPT_CONTENT_LENGTH = 5000;
const MAX_WORKSPACE_NAME_LENGTH = 50;
const MAX_WORKSPACE_DESCRIPTION_LENGTH = 500;

// Cache validation schemas for performance
const promptSchema = yup.object().shape({
  title: yup.string()
    .required('Prompt title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(MAX_PROMPT_TITLE_LENGTH, `Title cannot exceed ${MAX_PROMPT_TITLE_LENGTH} characters`)
    .matches(/^[^<>'"]*$/, 'Title contains invalid characters'),
  
  content: yup.string()
    .required('Prompt content is required')
    .min(10, 'Content must be at least 10 characters')
    .max(MAX_PROMPT_CONTENT_LENGTH, `Content cannot exceed ${MAX_PROMPT_CONTENT_LENGTH} characters`),
  
  variables: yup.array().of(
    yup.object().shape({
      name: yup.string().required('Variable name is required'),
      type: yup.string().required('Variable type is required'),
      description: yup.string(),
      required: yup.boolean()
    })
  )
});

const workspaceSchema = yup.object().shape({
  name: yup.string()
    .required('Workspace name is required')
    .min(3, 'Name must be at least 3 characters')
    .max(MAX_WORKSPACE_NAME_LENGTH, `Name cannot exceed ${MAX_WORKSPACE_NAME_LENGTH} characters`)
    .matches(/^[^<>'"]*$/, 'Name contains invalid characters'),
  
  description: yup.string()
    .max(MAX_WORKSPACE_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_WORKSPACE_DESCRIPTION_LENGTH} characters`)
});

/**
 * Validates prompt data against schema requirements with comprehensive security checks
 * @param prompt - The prompt object to validate
 * @returns Promise resolving to true if valid, throws ValidationError if invalid
 */
export const validatePrompt = async (prompt: IPrompt): Promise<boolean> => {
  try {
    await promptSchema.validate(prompt, { abortEarly: false });
    
    // Additional security checks
    if (prompt.templateId && !isValidUUID(prompt.templateId)) {
      throw new Error('Invalid template ID format');
    }
    
    // Check for potential XSS patterns
    if (containsXSSPatterns(prompt.content)) {
      throw new Error('Content contains potentially unsafe patterns');
    }
    
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Validates email format according to RFC 5322 standard with security checks
 * @param email - The email string to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  if (!email || email.length > 254) {
    return false;
  }

  // Basic format validation
  if (!EMAIL_REGEX.test(email)) {
    return false;
  }

  // Additional security checks
  const [localPart, domain] = email.split('@');
  
  // Local part checks
  if (localPart.length > 64 || /[<>'"()]/.test(localPart)) {
    return false;
  }

  // Domain checks
  if (domain.length > 255 || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return false;
  }

  return true;
};

/**
 * Validates workspace creation/update payload with comprehensive security checks
 * @param payload - The workspace payload to validate
 * @returns Promise resolving to true if valid, throws ValidationError if invalid
 */
export const validateWorkspacePayload = async (payload: WorkspaceCreatePayload): Promise<boolean> => {
  try {
    await workspaceSchema.validate(payload, { abortEarly: false });
    
    // Validate settings if present
    if (payload.settings) {
      validateWorkspaceSettings(payload.settings);
    }
    
    // Validate member permissions if present
    if (payload.initialMembers) {
      validateWorkspaceMembers(payload.initialMembers);
    }
    
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Sanitizes user input to prevent XSS and injection attacks
 * @param input - The string to sanitize
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape special characters
    .replace(/[&<>"']/g, (char) => {
      const entities: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return entities[char];
    })
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim();
};

/**
 * Validates UUID format
 * @param uuid - The UUID string to validate
 * @returns boolean indicating if UUID is valid
 */
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Checks for potential XSS patterns in content
 * @param content - The content to check
 * @returns boolean indicating if content contains XSS patterns
 */
const containsXSSPatterns = (content: string): boolean => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:\s*[^,]+/gi
  ];
  
  return xssPatterns.some(pattern => pattern.test(content));
};

/**
 * Validates workspace settings object
 * @param settings - The settings object to validate
 * @throws Error if settings are invalid
 */
const validateWorkspaceSettings = (settings: any): void => {
  const requiredSettings = ['isPublic', 'allowComments', 'autoSave'];
  for (const setting of requiredSettings) {
    if (typeof settings[setting] !== 'boolean') {
      throw new Error(`Invalid workspace setting: ${setting}`);
    }
  }
};

/**
 * Validates workspace member permissions
 * @param members - Array of workspace members to validate
 * @throws Error if member permissions are invalid
 */
const validateWorkspaceMembers = (members: any[]): void => {
  const validRoles = ['ADMIN', 'EDITOR', 'VIEWER'];
  for (const member of members) {
    if (!isValidUUID(member.userId) || !validRoles.includes(member.role)) {
      throw new Error('Invalid member configuration');
    }
  }
};