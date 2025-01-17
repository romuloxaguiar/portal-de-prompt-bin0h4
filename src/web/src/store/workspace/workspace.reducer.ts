/**
 * @fileoverview Redux reducer for workspace state management
 * Handles workspace CRUD operations, member management, and real-time collaboration
 * @version 1.0.0
 */

import { WorkspaceState, WorkspaceAction, WorkspaceActionTypes } from './workspace.types';
import { Workspace, WorkspaceRole } from '../../interfaces/workspace.interface';

/**
 * Initial state for workspace management
 */
export const initialState: WorkspaceState = {
  workspaces: [],
  currentWorkspace: null,
  loading: {
    fetchWorkspaces: false,
    createWorkspace: false,
    updateWorkspace: false,
    deleteWorkspace: false,
    memberOperations: false,
  },
  errors: {
    fetchWorkspaces: null,
    createWorkspace: null,
    updateWorkspace: null,
    deleteWorkspace: null,
    memberOperations: null,
  },
  syncStatus: {
    connected: false,
    lastSync: null,
    pendingUpdates: 0,
  }
};

/**
 * Workspace reducer handling state updates for workspace management
 * @param state - Current workspace state
 * @param action - Dispatched workspace action
 * @returns Updated workspace state
 */
export const workspaceReducer = (
  state: WorkspaceState = initialState,
  action: WorkspaceAction
): WorkspaceState => {
  switch (action.type) {
    // Fetch workspaces
    case WorkspaceActionTypes.FETCH_WORKSPACES_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, fetchWorkspaces: true },
        errors: { ...state.errors, fetchWorkspaces: null }
      };

    case WorkspaceActionTypes.FETCH_WORKSPACES_SUCCESS:
      return {
        ...state,
        workspaces: action.payload?.workspaces || [],
        loading: { ...state.loading, fetchWorkspaces: false },
        errors: { ...state.errors, fetchWorkspaces: null }
      };

    case WorkspaceActionTypes.FETCH_WORKSPACES_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, fetchWorkspaces: false },
        errors: { ...state.errors, fetchWorkspaces: action.error || 'Failed to fetch workspaces' }
      };

    // Create workspace
    case WorkspaceActionTypes.CREATE_WORKSPACE_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, createWorkspace: true },
        errors: { ...state.errors, createWorkspace: null }
      };

    case WorkspaceActionTypes.CREATE_WORKSPACE_SUCCESS:
      return {
        ...state,
        workspaces: [...state.workspaces, action.payload?.workspace as Workspace],
        currentWorkspace: action.payload?.workspace as Workspace,
        loading: { ...state.loading, createWorkspace: false },
        errors: { ...state.errors, createWorkspace: null }
      };

    case WorkspaceActionTypes.CREATE_WORKSPACE_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, createWorkspace: false },
        errors: { ...state.errors, createWorkspace: action.error || 'Failed to create workspace' }
      };

    // Update workspace
    case WorkspaceActionTypes.UPDATE_WORKSPACE_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, updateWorkspace: true },
        errors: { ...state.errors, updateWorkspace: null }
      };

    case WorkspaceActionTypes.UPDATE_WORKSPACE_SUCCESS: {
      const updatedWorkspace = action.payload?.workspace as Workspace;
      return {
        ...state,
        workspaces: state.workspaces.map(workspace => 
          workspace.id === updatedWorkspace.id ? updatedWorkspace : workspace
        ),
        currentWorkspace: state.currentWorkspace?.id === updatedWorkspace.id 
          ? updatedWorkspace 
          : state.currentWorkspace,
        loading: { ...state.loading, updateWorkspace: false },
        errors: { ...state.errors, updateWorkspace: null }
      };
    }

    case WorkspaceActionTypes.UPDATE_WORKSPACE_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, updateWorkspace: false },
        errors: { ...state.errors, updateWorkspace: action.error || 'Failed to update workspace' }
      };

    // Delete workspace
    case WorkspaceActionTypes.DELETE_WORKSPACE_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, deleteWorkspace: true },
        errors: { ...state.errors, deleteWorkspace: null }
      };

    case WorkspaceActionTypes.DELETE_WORKSPACE_SUCCESS: {
      const deletedWorkspaceId = action.payload?.workspaceId as string;
      return {
        ...state,
        workspaces: state.workspaces.filter(workspace => workspace.id !== deletedWorkspaceId),
        currentWorkspace: state.currentWorkspace?.id === deletedWorkspaceId 
          ? null 
          : state.currentWorkspace,
        loading: { ...state.loading, deleteWorkspace: false },
        errors: { ...state.errors, deleteWorkspace: null }
      };
    }

    case WorkspaceActionTypes.DELETE_WORKSPACE_FAILURE:
      return {
        ...state,
        loading: { ...state.loading, deleteWorkspace: false },
        errors: { ...state.errors, deleteWorkspace: action.error || 'Failed to delete workspace' }
      };

    // Member management
    case WorkspaceActionTypes.ADD_MEMBER_REQUEST:
      return {
        ...state,
        loading: { ...state.loading, memberOperations: true },
        errors: { ...state.errors, memberOperations: null }
      };

    case WorkspaceActionTypes.ADD_MEMBER_SUCCESS: {
      const updatedWorkspace = action.payload?.workspace as Workspace;
      return {
        ...state,
        workspaces: state.workspaces.map(workspace =>
          workspace.id === updatedWorkspace.id ? updatedWorkspace : workspace
        ),
        currentWorkspace: state.currentWorkspace?.id === updatedWorkspace.id
          ? updatedWorkspace
          : state.currentWorkspace,
        loading: { ...state.loading, memberOperations: false },
        errors: { ...state.errors, memberOperations: null }
      };
    }

    case WorkspaceActionTypes.UPDATE_MEMBER_ROLE_SUCCESS: {
      const { workspace, member } = action.payload || {};
      if (!workspace || !member) return state;

      const updatedWorkspace = {
        ...workspace,
        members: workspace.members.map(m =>
          m.userId === member.userId ? { ...m, role: member.role } : m
        )
      };

      return {
        ...state,
        workspaces: state.workspaces.map(w =>
          w.id === updatedWorkspace.id ? updatedWorkspace : w
        ),
        currentWorkspace: state.currentWorkspace?.id === updatedWorkspace.id
          ? updatedWorkspace
          : state.currentWorkspace,
        loading: { ...state.loading, memberOperations: false },
        errors: { ...state.errors, memberOperations: null }
      };
    }

    // Real-time sync actions
    case WorkspaceActionTypes.SYNC_WORKSPACE_UPDATE: {
      const syncedWorkspace = action.payload?.workspace as Workspace;
      if (!syncedWorkspace) return state;

      return {
        ...state,
        workspaces: state.workspaces.map(workspace =>
          workspace.id === syncedWorkspace.id ? syncedWorkspace : workspace
        ),
        currentWorkspace: state.currentWorkspace?.id === syncedWorkspace.id
          ? syncedWorkspace
          : state.currentWorkspace,
        syncStatus: {
          ...state.syncStatus,
          lastSync: new Date(),
          pendingUpdates: Math.max(0, state.syncStatus.pendingUpdates - 1)
        }
      };
    }

    case WorkspaceActionTypes.UPDATE_WORKSPACE_SETTINGS: {
      const { workspaceId, settings } = action.payload || {};
      if (!workspaceId || !settings) return state;

      return {
        ...state,
        workspaces: state.workspaces.map(workspace =>
          workspace.id === workspaceId
            ? { ...workspace, settings: { ...workspace.settings, ...settings } }
            : workspace
        ),
        currentWorkspace: state.currentWorkspace?.id === workspaceId
          ? { ...state.currentWorkspace, settings: { ...state.currentWorkspace.settings, ...settings } }
          : state.currentWorkspace
      };
    }

    default:
      return state;
  }
};