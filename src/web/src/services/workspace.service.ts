/**
 * Enhanced service class for managing workspaces and team collaboration with optimized performance.
 * Implements real-time updates, caching, and comprehensive error handling.
 * @version 1.0.0
 */

import { apiService } from './api.service';
import WebSocketService from './websocket.service';
import { API_ENDPOINTS } from '../constants/api.constant';
import { createError, handleError } from '../utils/error.util';
import { ErrorCode } from '../constants/error.constant';

/**
 * Interface for workspace data structure
 */
interface Workspace {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    settings: WorkspaceSettings;
    members: WorkspaceMember[];
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Interface for workspace settings
 */
interface WorkspaceSettings {
    allowPublicPrompts: boolean;
    defaultPromptVisibility: 'private' | 'team' | 'public';
    enableRealTimeCollaboration: boolean;
    maxMembers: number;
    retentionPeriod: number;
}

/**
 * Interface for workspace member data
 */
interface WorkspaceMember {
    userId: string;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    joinedAt: Date;
    lastActive: Date;
}

/**
 * Interface for workspace update events
 */
interface WorkspaceUpdate {
    type: 'create' | 'update' | 'delete' | 'member';
    workspaceId: string;
    data: any;
    timestamp: number;
}

/**
 * Enhanced workspace service with real-time collaboration support
 */
export class WorkspaceService {
    private readonly webSocketService: WebSocketService;
    private readonly retryAttempts: number = 3;
    private readonly batchDelay: number = 100;
    private readonly cache: Map<string, { data: Workspace; timestamp: number }>;
    private readonly cacheDuration: number = 300000; // 5 minutes

    constructor(webSocketService: WebSocketService) {
        this.webSocketService = webSocketService;
        this.cache = new Map();
        this.setupWebSocket();
    }

    /**
     * Retrieves all workspaces with caching and error handling
     */
    public async getWorkspaces(): Promise<Workspace[]> {
        try {
            const response = await apiService.get(API_ENDPOINTS.WORKSPACES.BASE);
            return response.data;
        } catch (error) {
            throw handleError(error);
        }
    }

    /**
     * Retrieves a specific workspace by ID with caching
     */
    public async getWorkspace(id: string): Promise<Workspace> {
        try {
            // Check cache first
            const cached = this.getFromCache(id);
            if (cached) return cached;

            const response = await apiService.get(
                API_ENDPOINTS.WORKSPACES.BY_ID.replace(':id', id)
            );
            
            // Update cache
            this.setInCache(id, response.data);
            return response.data;
        } catch (error) {
            throw handleError(error);
        }
    }

    /**
     * Creates a new workspace with real-time notification
     */
    public async createWorkspace(data: Partial<Workspace>): Promise<Workspace> {
        try {
            const response = await apiService.post(API_ENDPOINTS.WORKSPACES.BASE, data);
            this.notifyWorkspaceUpdate({
                type: 'create',
                workspaceId: response.data.id,
                data: response.data,
                timestamp: Date.now()
            });
            return response.data;
        } catch (error) {
            throw handleError(error);
        }
    }

    /**
     * Updates workspace details with optimistic updates
     */
    public async updateWorkspace(id: string, data: Partial<Workspace>): Promise<Workspace> {
        try {
            // Optimistic cache update
            const currentData = await this.getWorkspace(id);
            const optimisticData = { ...currentData, ...data, updatedAt: new Date() };
            this.setInCache(id, optimisticData);

            const response = await apiService.put(
                API_ENDPOINTS.WORKSPACES.BY_ID.replace(':id', id),
                data
            );

            this.notifyWorkspaceUpdate({
                type: 'update',
                workspaceId: id,
                data: response.data,
                timestamp: Date.now()
            });

            return response.data;
        } catch (error) {
            // Revert optimistic update on error
            this.cache.delete(id);
            throw handleError(error);
        }
    }

    /**
     * Manages workspace members with real-time updates
     */
    public async updateWorkspaceMember(
        workspaceId: string,
        userId: string,
        role: WorkspaceMember['role']
    ): Promise<void> {
        try {
            await apiService.put(
                API_ENDPOINTS.WORKSPACES.MEMBERS.replace(':id', workspaceId),
                { userId, role }
            );

            this.notifyWorkspaceUpdate({
                type: 'member',
                workspaceId,
                data: { userId, role },
                timestamp: Date.now()
            });
        } catch (error) {
            throw handleError(error);
        }
    }

    /**
     * Deletes a workspace with confirmation and cleanup
     */
    public async deleteWorkspace(id: string): Promise<void> {
        try {
            await apiService.delete(API_ENDPOINTS.WORKSPACES.BY_ID.replace(':id', id));
            this.cache.delete(id);
            
            this.notifyWorkspaceUpdate({
                type: 'delete',
                workspaceId: id,
                data: null,
                timestamp: Date.now()
            });
        } catch (error) {
            throw handleError(error);
        }
    }

    /**
     * Handles WebSocket reconnection with exponential backoff
     */
    public async handleWebSocketReconnection(): Promise<void> {
        let attempt = 0;
        const maxAttempts = this.retryAttempts;
        const baseDelay = 1000;

        while (attempt < maxAttempts) {
            try {
                await this.webSocketService.connect(
                    `${API_ENDPOINTS.WORKSPACES.BASE}/ws`
                );
                return;
            } catch (error) {
                attempt++;
                if (attempt === maxAttempts) {
                    throw createError(ErrorCode.NETWORK_ERROR, {
                        message: 'Failed to reconnect to workspace service'
                    });
                }
                await new Promise(resolve => 
                    setTimeout(resolve, baseDelay * Math.pow(2, attempt))
                );
            }
        }
    }

    /**
     * Batches multiple workspace updates for performance optimization
     */
    public async batchWorkspaceUpdates(updates: WorkspaceUpdate[]): Promise<void> {
        const batchedUpdates = new Map<string, WorkspaceUpdate>();

        // Deduplicate updates by workspaceId, keeping only the latest
        updates.forEach(update => {
            batchedUpdates.set(update.workspaceId, update);
        });

        // Process batched updates
        const processUpdates = async () => {
            try {
                await this.webSocketService.emit('workspace_batch_update', 
                    Array.from(batchedUpdates.values())
                );
            } catch (error) {
                throw handleError(error);
            }
        };

        // Debounce processing
        setTimeout(processUpdates, this.batchDelay);
    }

    /**
     * Sets up WebSocket event handlers for real-time updates
     */
    private setupWebSocket(): void {
        this.webSocketService.subscribe('workspace_update', (update: WorkspaceUpdate) => {
            if (update.type === 'delete') {
                this.cache.delete(update.workspaceId);
            } else if (update.data) {
                this.setInCache(update.workspaceId, update.data);
            }
        });
    }

    /**
     * Retrieves workspace data from cache if valid
     */
    private getFromCache(id: string): Workspace | null {
        const cached = this.cache.get(id);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.cacheDuration) {
            this.cache.delete(id);
            return null;
        }

        return cached.data;
    }

    /**
     * Updates cache with new workspace data
     */
    private setInCache(id: string, data: Workspace): void {
        this.cache.set(id, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Notifies all subscribers of workspace updates
     */
    private notifyWorkspaceUpdate(update: WorkspaceUpdate): void {
        if (this.webSocketService.isConnected()) {
            this.webSocketService.emit('workspace_update', update);
        }
    }
}