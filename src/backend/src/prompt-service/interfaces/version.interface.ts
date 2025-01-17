/**
 * Core interfaces for version control functionality in the Prompts Portal system.
 * Implements version structure, change tracking, and version metadata based on
 * technical specifications for prompt management version control.
 * @version 1.0.0
 */

/**
 * Main interface defining the structure of a version in the system.
 * Maps to the VERSION entity in the database schema.
 */
export interface IVersion {
    /** Unique identifier for the version */
    id: string;

    /** Reference to the parent prompt */
    promptId: string;

    /** Complete content of the prompt at this version */
    content: string;

    /** Detailed tracking of changes from previous version */
    changes: IVersionChanges;

    /** Sequential version number for the prompt */
    versionNumber: number;

    /** User ID of version creator */
    createdBy: string;

    /** Timestamp of version creation */
    createdAt: Date;
}

/**
 * Interface for tracking detailed changes between versions.
 * Provides comprehensive change tracking for auditing and rollback capabilities.
 */
export interface IVersionChanges {
    /** Array of new content segments added in this version */
    addedContent: string[];

    /** Array of content segments removed in this version */
    removedContent: string[];

    /** Array of variable modifications in this version */
    modifiedVariables: IVariableChange[];

    /** Human-readable description of changes */
    description: string;

    /** Precise timestamp of changes */
    timestamp: Date;
}

/**
 * Interface for tracking changes to prompt variables between versions.
 * Enables detailed tracking of variable modifications for template management.
 */
export interface IVariableChange {
    /** Name of the modified variable */
    name: string;

    /** Previous value of the variable */
    oldValue: any;

    /** New value of the variable */
    newValue: any;

    /** Type of variable change (e.g., 'added', 'removed', 'modified') */
    type: string;
}