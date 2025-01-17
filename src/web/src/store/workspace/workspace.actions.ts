/**
 * Redux action creators for workspace management operations.
 * Implements CRUD operations, member management, real-time collaboration,
 * and enhanced error handling with performance optimizations.
 * @version 1.0.0
 */

import { Dispatch } from 'redux';
import { ThunkAction } from 'redux-thunk';
import { batch } from 'redux-batched-actions';
import { WorkspaceActionTypes } from './workspace.types';
import { WebSocketService } from '../../services/websocket.service';
import { analyticsService } from '../../services/analytics.service';
import { apiService } from '../../services/api.service';
import { storage, StorageKeys } from '../../utils/storage.util';
import { handleError, createError } from '../../utils/error.util';
import { ErrorCode } from '../../utils/error.util';
import { API_ENDPOINTS } from '../../constants/api.constant';
import { MetricType } from '../../interfaces/analytics.interface';
import { 
    Workspace, 
    WorkspaceMember, 
    WorkspaceRole,
    WorkspaceSettings 
} from '../../interfaces/workspace.interface';

// Types
type AppThunk<ReturnType = void> = ThunkAction<
    Promise<ReturnType>,
    any,
    unknown,
    any
>;

// Cache configuration
const WORKSPACE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BATCH_DELAY = 300; // 300ms for batching

/**
 * Fetches workspaces list with caching and error handling
 */
export const fetchWorkspaces = (): AppThunk => async (dispatch: Dispatch) => {
    try {
        dispatch({ type: WorkspaceActionTypes.FETCH_WORKSPACES_REQUEST });

        // Check cache first
        const cachedWorkspaces = await storage.getItem<Workspace[]>(
            StorageKeys.WORKSPACE_SETTINGS,
            { encrypt: true }
        );

        if (cachedWorkspaces) {
            dispatch({
                type: WorkspaceActionTypes.FETCH_WORKSPACES_SUCCESS,
                payload: { workspaces: cachedWorkspaces }
            });
            return;
        }

        const response = await apiService.get<Workspace[]>(
            API_ENDPOINTS.WORKSPACES.BASE
        );

        // Track analytics
        analyticsService.trackMetric({
            type: MetricType.USAGE,
            value: 1,
            metadata: { action: 'fetch_workspaces' }
        });

        // Batch dispatch for performance
        batch(() => {
            dispatch({
                type: WorkspaceActionTypes.FETCH_WORKSPACES_SUCCESS,
                payload: { workspaces: response.data }
            });

            // Cache the fetched workspaces
            storage.setItem(StorageKeys.WORKSPACE_SETTINGS, response.data, {
                encrypt: true,
                ttl: WORKSPACE_CACHE_TTL
            });
        });
    } catch (error) {
        const appError = handleError(error);
        dispatch({
            type: WorkspaceActionTypes.FETCH_WORKSPACES_FAILURE,
            payload: { error: appError.message }
        });
        throw appError;
    }
};

/**
 * Creates a new workspace with validation and real-time updates
 */
export const createWorkspace = (
    workspace: Omit<Workspace, 'id'>
): AppThunk<Workspace> => async (dispatch: Dispatch) => {
    try {
        dispatch({ type: WorkspaceActionTypes.CREATE_WORKSPACE_REQUEST });

        const response = await apiService.post<Workspace>(
            API_ENDPOINTS.WORKSPACES.BASE,
            workspace
        );

        analyticsService.trackMetric({
            type: MetricType.USAGE,
            value: 1,
            metadata: { action: 'create_workspace' }
        });

        dispatch({
            type: WorkspaceActionTypes.CREATE_WORKSPACE_SUCCESS,
            payload: { workspace: response.data }
        });

        return response.data;
    } catch (error) {
        const appError = handleError(error);
        dispatch({
            type: WorkspaceActionTypes.CREATE_WORKSPACE_FAILURE,
            payload: { error: appError.message }
        });
        throw appError;
    }
};

/**
 * Updates workspace settings with optimistic updates
 */
export const updateWorkspaceSettings = (
    workspaceId: string,
    settings: WorkspaceSettings
): AppThunk => async (dispatch: Dispatch) => {
    try {
        dispatch({
            type: WorkspaceActionTypes.UPDATE_WORKSPACE_SETTINGS,
            payload: { workspaceId, settings }
        });

        const response = await apiService.put(
            API_ENDPOINTS.WORKSPACES.SETTINGS.replace(':id', workspaceId),
            settings
        );

        analyticsService.trackMetric({
            type: MetricType.USAGE,
            value: 1,
            metadata: { action: 'update_workspace_settings' }
        });

        return response.data;
    } catch (error) {
        const appError = handleError(error);
        // Revert optimistic update on failure
        dispatch({
            type: WorkspaceActionTypes.UPDATE_WORKSPACE_FAILURE,
            payload: { error: appError.message }
        });
        throw appError;
    }
};

/**
 * Manages workspace members with role validation
 */
export const addWorkspaceMember = (
    workspaceId: string,
    member: Omit<WorkspaceMember, 'joinedAt' | 'lastActive'>
): AppThunk => async (dispatch: Dispatch) => {
    try {
        dispatch({ type: WorkspaceActionTypes.ADD_MEMBER_REQUEST });

        if (!Object.values(WorkspaceRole).includes(member.role)) {
            throw createError(ErrorCode.VALIDATION_ERROR, {
                message: 'Invalid workspace role'
            });
        }

        const response = await apiService.post(
            API_ENDPOINTS.WORKSPACES.MEMBERS.replace(':id', workspaceId),
            member
        );

        dispatch({
            type: WorkspaceActionTypes.ADD_MEMBER_SUCCESS,
            payload: { workspaceId, member: response.data }
        });

        return response.data;
    } catch (error) {
        const appError = handleError(error);
        dispatch({
            type: WorkspaceActionTypes.ADD_MEMBER_FAILURE,
            payload: { error: appError.message }
        });
        throw appError;
    }
};

/**
 * Sets up real-time workspace collaboration
 */
export const setupWorkspaceRealtime = (
    workspaceId: string
): AppThunk => async (dispatch: Dispatch) => {
    try {
        const wsService = new WebSocketService();
        await wsService.connect(`${API_ENDPOINTS.WORKSPACES.BASE}/realtime`);

        wsService.subscribe(`workspace:${workspaceId}`, (data: any) => {
            dispatch({
                type: WorkspaceActionTypes.SYNC_WORKSPACE_UPDATE,
                payload: data
            });
        });

        wsService.subscribe(`workspace:${workspaceId}:members`, (data: any) => {
            dispatch({
                type: WorkspaceActionTypes.SYNC_MEMBER_UPDATE,
                payload: data
            });
        });

        return true;
    } catch (error) {
        const appError = handleError(error);
        throw appError;
    }
};

/**
 * Removes workspace member with validation
 */
export const removeWorkspaceMember = (
    workspaceId: string,
    memberId: string
): AppThunk => async (dispatch: Dispatch) => {
    try {
        dispatch({ type: WorkspaceActionTypes.REMOVE_MEMBER_REQUEST });

        await apiService.delete(
            `${API_ENDPOINTS.WORKSPACES.MEMBERS.replace(':id', workspaceId)}/${memberId}`
        );

        dispatch({
            type: WorkspaceActionTypes.REMOVE_MEMBER_SUCCESS,
            payload: { workspaceId, memberId }
        });

        analyticsService.trackMetric({
            type: MetricType.TEAM_COLLABORATION,
            value: 1,
            metadata: { action: 'remove_member' }
        });
    } catch (error) {
        const appError = handleError(error);
        dispatch({
            type: WorkspaceActionTypes.REMOVE_MEMBER_FAILURE,
            payload: { error: appError.message }
        });
        throw appError;
    }
};

/**
 * Updates workspace member role with validation
 */
export const updateMemberRole = (
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole
): AppThunk => async (dispatch: Dispatch) => {
    try {
        dispatch({ type: WorkspaceActionTypes.UPDATE_MEMBER_ROLE_REQUEST });

        if (!Object.values(WorkspaceRole).includes(role)) {
            throw createError(ErrorCode.VALIDATION_ERROR, {
                message: 'Invalid workspace role'
            });
        }

        const response = await apiService.put(
            `${API_ENDPOINTS.WORKSPACES.MEMBERS.replace(':id', workspaceId)}/${memberId}`,
            { role }
        );

        dispatch({
            type: WorkspaceActionTypes.UPDATE_MEMBER_ROLE_SUCCESS,
            payload: { workspaceId, memberId, role }
        });

        return response.data;
    } catch (error) {
        const appError = handleError(error);
        dispatch({
            type: WorkspaceActionTypes.UPDATE_MEMBER_ROLE_FAILURE,
            payload: { error: appError.message }
        });
        throw appError;
    }
};