import { Document } from 'mongoose'; // v7.0.0

/**
 * Enumeration of supported variable types in templates with extended support
 */
export type TemplateVariableType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'array' 
  | 'object' 
  | 'date' 
  | 'email' 
  | 'url' 
  | 'regex' 
  | 'custom';

/**
 * Interface defining comprehensive validation rules for template variables
 */
export interface ITemplateVariableValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minValue?: number;
  maxValue?: number;
  enum?: any[];
  customValidator?: string;
  errorMessage?: string;
  format?: string;
  dependencies?: string[];
}

/**
 * Interface defining the structure of template variables with validation support
 */
export interface ITemplateVariable {
  name: string;
  type: TemplateVariableType;
  description: string;
  required: boolean;
  defaultValue: any;
  validationRules: ITemplateVariableValidation;
  examples: string[];
  placeholder: string;
  group: string;
  order: number;
}

/**
 * Interface defining comprehensive template usage and performance metadata
 */
export interface ITemplateMetadata {
  usageCount: number;
  successRate: number;
  lastUsed: Date;
  averagePromptLength: number;
  averageResponseTime: number;
  failureCount: number;
  popularVariables: Array<{
    name: string;
    useCount: number;
  }>;
  userRating: number;
  costEstimate: number;
}

/**
 * Core interface defining the structure of a prompt template with MongoDB integration
 */
export interface ITemplate extends Document {
  id: string;
  name: string;
  description: string;
  content: string;
  variables: ITemplateVariable[];
  category: string;
  creatorId: string;
  teamId: string;
  isPublic: boolean;
  metadata: ITemplateMetadata;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  tags: string[];
  parentTemplateId: string | null;
}