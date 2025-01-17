import { Types } from 'mongoose'; // v7.0.0

/**
 * Enumeration of user roles for role-based access control (RBAC)
 * Defines access levels according to the security authorization matrix
 */
export enum UserRole {
    ADMIN = 'ADMIN',                   // Full system access
    TEAM_MANAGER = 'TEAM_MANAGER',     // Team management and analytics access
    EDITOR = 'EDITOR',                 // Content creation and editing access
    VIEWER = 'VIEWER'                  // Read-only access
}

/**
 * Enumeration of possible user account statuses
 * Used for lifecycle management and security control
 */
export enum UserStatus {
    ACTIVE = 'ACTIVE',         // Account is active and can access the system
    INACTIVE = 'INACTIVE',     // Account is deactivated but can be reactivated
    SUSPENDED = 'SUSPENDED',   // Account is temporarily disabled due to violations
    PENDING = 'PENDING',       // Account awaiting email verification or approval
    LOCKED = 'LOCKED'         // Account locked due to security concerns (failed logins, etc.)
}

/**
 * Core user interface defining the structure of user data
 * Implements security requirements including audit fields and MFA support
 */
export interface IUser {
    /** MongoDB document ID */
    id: Types.ObjectId;
    
    /** User's email address (unique identifier) */
    email: string;
    
    /** User's first name */
    firstName: string;
    
    /** User's last name */
    lastName: string;
    
    /** Hashed password string */
    password: string;
    
    /** User's assigned role for RBAC */
    role: UserRole;
    
    /** Current account status */
    status: UserStatus;
    
    /** Associated workspace ID */
    workspaceId: Types.ObjectId;
    
    /** Timestamp of last successful login */
    lastLoginAt: Date;
    
    /** Flag indicating if MFA is enabled for the account */
    mfaEnabled: boolean;
    
    /** MFA secret key if enabled, null otherwise */
    mfaSecret: string | null;
    
    /** Counter for consecutive failed login attempts */
    failedLoginAttempts: number;
    
    /** Timestamp of last password change */
    passwordLastChangedAt: Date;
    
    /** Account creation timestamp */
    createdAt: Date;
    
    /** Last account update timestamp */
    updatedAt: Date;
}