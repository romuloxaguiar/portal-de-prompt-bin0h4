/**
 * @fileoverview Redux action types and state interfaces for workspace management
 * Handles team collaboration, real-time updates, and role-based access control
 * @version 1.0.0
 */

import { Workspace, WorkspaceMember } from '../../interfaces/workspace.interface';

/**
 * Enumeration of all workspace-related Redux action types
 */
export enum WorkspaceActionTypes {
    // Fetch workspaces
    FETCH_WORKSPACES_REQUEST = '@workspace/FETCH_WORKSPACES_REQUEST',
    FETCH_WORKSPACES_SUCCESS = '@workspace/FETCH_WORKSPACES_SUCCESS',
    FETCH_WORKSPACES_FAILURE = '@workspace/FETCH_WORKSPACES_FAILURE',

    // Create workspace
    CREATE_WORKSPACE_REQUEST = '@workspace/CREATE_WORKSPACE_REQUEST',
    CREATE_WORKSPACE_SUCCESS = '@workspace/CREATE_WORKSPACE_SUCCESS',
    CREATE_WORKSPACE_FAILURE = '@workspace/CREATE_WORKSPACE_FAILURE',

    // Update workspace
    UPDATE_WORKSPACE_REQUEST = '@workspace/UPDATE_WORKSPACE_REQUEST',
    UPDATE_WORKSPACE_SUCCESS = '@workspace/UPDATE_WORKSPACE_SUCCESS',
    UPDATE_WORKSPACE_FAILURE = '@workspace/UPDATE_WORKSPACE_FAILURE',

    // Delete workspace
    DELETE_WORKSPACE_REQUEST = '@workspace/DELETE_WORKSPACE_REQUEST',
    DELETE_WORKSPACE_SUCCESS = '@workspace/DELETE_WORKSPACE_SUCCESS',
    DELETE_WORKSPACE_FAILURE = '@workspace/DELETE_WORKSPACE_FAILURE',

    // Member management
    ADD_MEMBER_REQUEST = '@workspace/ADD_MEMBER_REQUEST',
    ADD_MEMBER_SUCCESS = '@workspace/ADD_MEMBER_SUCCESS',
    ADD_MEMBER_FAILURE = '@workspace/ADD_MEMBER_FAILURE',

    REMOVE_MEMBER_REQUEST = '@workspace/REMOVE_MEMBER_REQUEST',
    REMOVE_MEMBER_SUCCESS = '@workspace/REMOVE_MEMBER_SUCCESS',
    REMOVE_MEMBER_FAILURE = '@workspace/REMOVE_MEMBER_FAILURE',

    UPDATE_MEMBER_ROLE_REQUEST = '@workspace/UPDATE_MEMBER_ROLE_REQUEST',
    UPDATE_MEMBER_ROLE_SUCCESS = '@workspace/UPDATE_MEMBER_ROLE_SUCCESS',
    UPDATE_MEMBER_ROLE_FAILURE = '@workspace/UPDATE_MEMBER_ROLE_FAILURE',

    // Real-time sync actions
    SYNC_WORKSPACE_UPDATE = '@workspace/SYNC_WORKSPACE_UPDATE',
    SYNC_MEMBER_UPDATE = '@workspace/SYNC_MEMBER_UPDATE',
    UPDATE_WORKSPACE_SETTINGS = '@workspace/UPDATE_WORKSPACE_SETTINGS'
}

/**
 * Interface defining the shape of the workspace state in Redux store
 */
export interface WorkspaceState {
    /** List of all workspaces available to the user */
    workspaces: Workspace[];

    /** Currently selected workspace */
    currentWorkspace: Workspace | null;

    /** Loading states for different operations */
    loading: {
        fetchWorkspaces: boolean;
        createWorkspace: boolean;
        updateWorkspace: boolean;
        deleteWorkspace: boolean;
        memberOperations: boolean;
        [key: string]: boolean;
    };

    /** Error states for different operations */
    errors: {
        fetchWorkspaces: string | null;
        createWorkspace: string | null;
        updateWorkspace: string | null;
        deleteWorkspace: string | null;
        memberOperations: string | null;
        [key: string]: string | null;
    };

    /** Real-time synchronization status */
    syncStatus: {
        connected: boolean;
        lastSync: Date | null;
        pendingUpdates: number;
    };
}

/**
 * Union type for all possible workspace action payloads
 */
export type WorkspacePayload = {
    workspace?: Workspace;
    workspaces?: Workspace[];
    workspaceId?: string;
    member?: WorkspaceMember;
    memberId?: string;
    settings?: Workspace['settings'];
    error?: string;
};

/**
 * Interface for workspace action metadata
 */
export interface WorkspaceActionMeta {
    /** Timestamp of the action */
    timestamp: Date;
    
    /** Source of the action (e.g., 'user', 'system', 'sync') */
    source: 'user' | 'system' | 'sync';
    
    /** Optional correlation ID for tracking related actions */
    correlationId?: string;
}

/**
 * Type definition for workspace actions with type safety
 */
export interface WorkspaceAction {
    /** Type of the action */
    type: WorkspaceActionTypes;
    
    /** Action payload */
    payload?: WorkspacePayload;
    
    /** Error message if action failed */
    error?: string | null;
    
    /** Action metadata */
    meta: WorkspaceActionMeta;
}

/**
 * Type guard to check if an action is a workspace action
 */
export function isWorkspaceAction(action: any): action is WorkspaceAction {
    return Object.values(WorkspaceActionTypes).includes(action.type);
}