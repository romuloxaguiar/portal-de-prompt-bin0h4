/**
 * @fileoverview TypeScript interfaces for prompt-related data structures
 * @version 1.0.0
 * @package @types/node ^18.0.0
 */

/**
 * Enum defining the possible lifecycle states of a prompt
 */
export enum PromptStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    ARCHIVED = 'ARCHIVED',
    DEPRECATED = 'DEPRECATED'
}

/**
 * Interface defining the structure of a prompt variable with validation
 * and type information for template support
 */
export interface IPromptVariable {
    /** Unique identifier for the variable */
    name: string;
    /** Current value of the variable */
    value: any;
    /** Data type of the variable (e.g., 'string', 'number', 'boolean') */
    type: string;
    /** Human-readable description of the variable's purpose */
    description: string;
    /** Indicates if the variable must be set before prompt usage */
    required: boolean;
}

/**
 * Interface for tracking prompt usage metrics, performance, and cost analytics
 */
export interface IPromptMetadata {
    /** Number of times the prompt has been used */
    usageCount: number;
    /** Percentage of successful prompt executions */
    successRate: number;
    /** Timestamp of the most recent usage */
    lastUsed: Date;
    /** Identifier of the AI model used (e.g., 'gpt-4', 'claude-2') */
    aiModel: string;
    /** Average time taken for prompt execution in milliseconds */
    averageResponseTime: number;
    /** Total tokens consumed by the prompt */
    totalTokens: number;
    /** Estimated cost of prompt usage in USD */
    costEstimate: number;
}

/**
 * Interface representing a version of a prompt
 */
export interface IVersion {
    /** Unique identifier for the version */
    id: string;
    /** Content of the prompt at this version */
    content: string;
    /** Metadata about the version changes */
    changes: {
        /** Description of changes made in this version */
        description: string;
        /** User who created this version */
        author: string;
        /** Timestamp of version creation */
        timestamp: Date;
    };
}

/**
 * Core interface defining the complete structure of a prompt entity
 * with support for versioning, templates, and analytics
 */
export interface IPrompt {
    /** Unique identifier for the prompt */
    id: string;
    /** Human-readable title of the prompt */
    title: string;
    /** Actual content of the prompt */
    content: string;
    /** Reference to a template if this prompt is based on one */
    templateId: string | null;
    /** Array of variables used in the prompt */
    variables: IPromptVariable[];
    /** ID of the user who created the prompt */
    creatorId: string;
    /** ID of the team that owns the prompt */
    teamId: string;
    /** Current version information */
    currentVersion: IVersion;
    /** Current lifecycle status of the prompt */
    status: PromptStatus;
    /** Usage and performance metrics */
    metadata: IPromptMetadata;
    /** Timestamp of prompt creation */
    createdAt: Date;
    /** Timestamp of last prompt update */
    updatedAt: Date;
}