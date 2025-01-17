import { ITemplate } from './template.interface';
import { IVersion } from './version.interface';

/**
 * Enumeration defining the possible states of a prompt in its lifecycle
 */
export enum PromptStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED'
}

/**
 * Interface defining the structure of prompt variables with type information
 * Provides type-safe variable handling for prompt instances
 */
export interface IPromptVariable {
    /** Name of the variable */
    name: string;
    
    /** Value of the variable - can be of any type based on template definition */
    value: any;
    
    /** Type of the variable for validation purposes */
    type: string;
}

/**
 * Interface for tracking comprehensive prompt usage and performance metrics
 * Enables detailed analytics and optimization capabilities
 */
export interface IPromptMetadata {
    /** Number of times the prompt has been used */
    usageCount: number;
    
    /** Success rate of prompt executions (0-100) */
    successRate: number;
    
    /** Timestamp of last prompt usage */
    lastUsed: Date;
    
    /** Identifier of the AI model used with this prompt */
    aiModel: string;
    
    /** Average response time in milliseconds */
    averageResponseTime: number;
}

/**
 * Core interface defining the structure of a prompt with comprehensive
 * metadata and lifecycle support. Implements the PROMPT entity from the
 * database schema design with enhanced tracking capabilities.
 */
export interface IPrompt {
    /** Unique identifier for the prompt */
    id: string;
    
    /** Human-readable title of the prompt */
    title: string;
    
    /** Actual content of the prompt */
    content: string;
    
    /** Reference to the template this prompt is based on */
    templateId: string;
    
    /** Array of variables used in this prompt instance */
    variables: IPromptVariable[];
    
    /** ID of the user who created the prompt */
    creatorId: string;
    
    /** ID of the team that owns the prompt */
    teamId: string;
    
    /** Current version information of the prompt */
    currentVersion: IVersion;
    
    /** Current lifecycle status of the prompt */
    status: PromptStatus;
    
    /** Comprehensive usage and performance metrics */
    metadata: IPromptMetadata;
    
    /** Timestamp of prompt creation */
    createdAt: Date;
    
    /** Timestamp of last prompt update */
    updatedAt: Date;
}