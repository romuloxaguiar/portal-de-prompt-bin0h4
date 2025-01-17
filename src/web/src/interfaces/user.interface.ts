/**
 * @fileoverview TypeScript interface definitions for user-related types in the frontend application.
 * Defines user data structure, roles, and status for authentication and authorization.
 * @version 1.0.0
 */

// TypeScript version: 5.0.0

/**
 * Enumeration of user roles for role-based access control (RBAC).
 * Maps to authorization matrix defined in security specifications.
 */
export enum UserRole {
    ADMIN = 'ADMIN',           // Full system access
    TEAM_MANAGER = 'MANAGER',  // Team management and analytics access
    EDITOR = 'EDITOR',         // Content creation and editing access
    VIEWER = 'VIEWER'          // Read-only access
}

/**
 * Enumeration of possible user account statuses.
 * Used for account lifecycle management and access control.
 */
export enum UserStatus {
    ACTIVE = 'ACTIVE',         // Account is active and can access system
    INACTIVE = 'INACTIVE',     // Account is deactivated but can be reactivated
    SUSPENDED = 'SUSPENDED',   // Account is temporarily suspended
    PENDING = 'PENDING'        // Account awaiting activation/verification
}

/**
 * Core user interface definition.
 * Contains all essential user properties for frontend application.
 */
export interface IUser {
    /** Unique identifier for the user */
    id: string;
    
    /** User's email address (used for authentication) */
    email: string;
    
    /** User's first name */
    firstName: string;
    
    /** User's last name */
    lastName: string;
    
    /** User's assigned role for RBAC */
    role: UserRole;
    
    /** Current status of the user account */
    status: UserStatus;
    
    /** ID of the workspace the user belongs to */
    workspaceId: string;
    
    /** Timestamp of user's last login */
    lastLoginAt: Date;
    
    /** Account creation timestamp */
    createdAt: Date;
    
    /** Last account update timestamp */
    updatedAt: Date;
}

/**
 * Interface for user login request payload.
 * Used when submitting login credentials.
 */
export interface UserLoginPayload {
    /** User's email address */
    email: string;
    
    /** User's password */
    password: string;
}

/**
 * Interface for user profile update request payload.
 * Defines updateable user profile fields.
 */
export interface UserUpdatePayload {
    /** Updated first name */
    firstName: string;
    
    /** Updated last name */
    lastName: string;
    
    /** Updated email address */
    email: string;
}