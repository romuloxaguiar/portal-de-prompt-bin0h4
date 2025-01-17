/**
 * @fileoverview TypeScript interface definitions for workspace-related data structures.
 * Provides type safety for workspace management features including team collaboration,
 * permissions, and real-time features.
 * @version 1.0.0
 */

// TypeScript version: 5.0.0

import { IUser } from './user.interface';

/**
 * Enumeration of workspace member roles.
 * Defines permission levels within a workspace context.
 */
export enum WorkspaceRole {
    ADMIN = 'ADMIN',     // Full workspace management access
    EDITOR = 'EDITOR',   // Can create and edit content
    VIEWER = 'VIEWER'    // Read-only access to workspace
}

/**
 * Interface defining workspace configuration settings.
 * Controls workspace behavior and feature availability.
 */
export interface WorkspaceSettings {
    /** Controls workspace visibility to non-members */
    isPublic: boolean;

    /** Enables/disables commenting features */
    allowComments: boolean;

    /** Controls automatic content saving */
    autoSave: boolean;

    /** Enables/disables real-time collaboration features */
    realTimeCollaboration: boolean;

    /** Enables/disables version history tracking */
    versionHistory: boolean;
}

/**
 * Interface for workspace member data.
 * Represents a user's membership within a workspace.
 */
export interface WorkspaceMember {
    /** ID of the user who is a member */
    userId: string;

    /** Reference to the full user object */
    user: IUser;

    /** Member's role within the workspace */
    role: WorkspaceRole;

    /** Timestamp when user joined the workspace */
    joinedAt: Date;

    /** Timestamp of member's last activity */
    lastActive: Date;
}

/**
 * Main workspace interface.
 * Defines the core workspace data structure.
 */
export interface Workspace {
    /** Unique identifier for the workspace */
    id: string;

    /** Display name of the workspace */
    name: string;

    /** Detailed description of the workspace */
    description: string;

    /** ID of the team that owns the workspace */
    teamId: string;

    /** List of workspace members */
    members: WorkspaceMember[];

    /** Workspace configuration settings */
    settings: WorkspaceSettings;

    /** Workspace creation timestamp */
    createdAt: Date;

    /** Last update timestamp */
    updatedAt: Date;

    /** Indicates if workspace is currently active */
    isActive: boolean;
}

/**
 * Interface for workspace creation payload.
 * Contains required data for creating a new workspace.
 */
export interface WorkspaceCreatePayload {
    /** Name for the new workspace */
    name: string;

    /** Description of the new workspace */
    description: string;

    /** ID of the team creating the workspace */
    teamId: string;

    /** Initial workspace settings */
    settings: WorkspaceSettings;

    /** Initial members to add to workspace */
    initialMembers: Array<{ userId: string; role: WorkspaceRole }>;
}

/**
 * Interface for workspace update payload.
 * Defines updateable workspace properties.
 */
export interface WorkspaceUpdatePayload {
    /** Updated workspace name */
    name: string;

    /** Updated workspace description */
    description: string;

    /** Updated workspace settings */
    settings: WorkspaceSettings;

    /** Updated workspace active status */
    isActive: boolean;
}