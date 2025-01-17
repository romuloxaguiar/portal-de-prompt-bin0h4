/**
 * Redux selectors for workspace state management with memoized performance optimization
 * Implements type-safe selectors for accessing workspace state data
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.0
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../root.reducer';
import type { WorkspaceState } from './workspace.types';
import type { Workspace, WorkspaceMember } from '../../interfaces/workspace.interface';

/**
 * Base selector to access the workspace slice from root state
 * Used as input selector for derived selectors
 */
export const selectWorkspaceState = (state: RootState): WorkspaceState => state.workspace;

/**
 * Memoized selector to get all available workspaces
 * Maintains referential equality for performance optimization
 */
export const selectWorkspaces = createSelector(
    [selectWorkspaceState],
    (workspaceState: WorkspaceState): Workspace[] => workspaceState.workspaces
);

/**
 * Memoized selector to get the currently active workspace
 * Returns null if no workspace is selected
 */
export const selectCurrentWorkspace = createSelector(
    [selectWorkspaceState],
    (workspaceState: WorkspaceState): Workspace | null => workspaceState.currentWorkspace
);

/**
 * Memoized selector to get loading states for workspace operations
 * Provides granular loading states for different operations
 */
export const selectWorkspaceLoading = createSelector(
    [selectWorkspaceState],
    (workspaceState: WorkspaceState): WorkspaceState['loading'] => workspaceState.loading
);

/**
 * Memoized selector to get error states for workspace operations
 * Provides granular error handling for different operations
 */
export const selectWorkspaceError = createSelector(
    [selectWorkspaceState],
    (workspaceState: WorkspaceState): WorkspaceState['errors'] => workspaceState.errors
);

/**
 * Memoized selector factory to get workspace by ID
 * @param workspaceId - ID of the workspace to retrieve
 * Returns undefined if workspace is not found
 */
export const selectWorkspaceById = (workspaceId: string) => createSelector(
    [selectWorkspaces],
    (workspaces: Workspace[]): Workspace | undefined => 
        workspaces.find(workspace => workspace.id === workspaceId)
);

/**
 * Memoized selector to get members of current workspace
 * Returns empty array if no workspace is selected
 */
export const selectWorkspaceMembers = createSelector(
    [selectCurrentWorkspace],
    (currentWorkspace: Workspace | null): WorkspaceMember[] => 
        currentWorkspace?.members || []
);

/**
 * Memoized selector to get real-time sync status
 * Provides sync state for real-time collaboration features
 */
export const selectWorkspaceSyncStatus = createSelector(
    [selectWorkspaceState],
    (workspaceState: WorkspaceState): WorkspaceState['syncStatus'] => workspaceState.syncStatus
);

/**
 * Memoized selector to get workspace settings
 * Returns null if no workspace is selected
 */
export const selectWorkspaceSettings = createSelector(
    [selectCurrentWorkspace],
    (currentWorkspace: Workspace | null) => currentWorkspace?.settings || null
);

/**
 * Memoized selector to check if current user is workspace admin
 * @param userId - ID of the current user
 */
export const selectIsWorkspaceAdmin = (userId: string) => createSelector(
    [selectCurrentWorkspace],
    (currentWorkspace: Workspace | null): boolean => {
        if (!currentWorkspace) return false;
        const member = currentWorkspace.members.find(m => m.userId === userId);
        return member?.role === 'ADMIN';
    }
);

/**
 * Memoized selector to get active workspaces
 * Filters out inactive workspaces for performance
 */
export const selectActiveWorkspaces = createSelector(
    [selectWorkspaces],
    (workspaces: Workspace[]): Workspace[] =>
        workspaces.filter(workspace => workspace.isActive)
);

/**
 * Memoized selector to get workspace creation timestamp
 * Returns null if no workspace is selected
 */
export const selectWorkspaceCreationDate = createSelector(
    [selectCurrentWorkspace],
    (currentWorkspace: Workspace | null): Date | null =>
        currentWorkspace ? currentWorkspace.createdAt : null
);

/**
 * Memoized selector to get workspace member count
 * Returns 0 if no workspace is selected
 */
export const selectWorkspaceMemberCount = createSelector(
    [selectWorkspaceMembers],
    (members: WorkspaceMember[]): number => members.length
);