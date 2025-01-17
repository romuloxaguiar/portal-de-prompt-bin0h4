import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { debounce } from 'lodash'; // ^4.17.21
import { WebSocketService } from '../services/websocket.service';
import { WorkspaceService } from '../services/workspace.service';
import { ErrorHandler } from '../utils/error.util';
import { AnalyticsService } from '../services/analytics.service';

// Constants for performance optimization
const DEBOUNCE_DELAY = 300;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

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
 * Interface for workspace data
 */
interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  settings: {
    allowPublicPrompts: boolean;
    defaultPromptVisibility: 'private' | 'team' | 'public';
    enableRealTimeCollaboration: boolean;
    maxMembers: number;
  };
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for collaboration state
 */
interface CollaborationState {
  workspace: Workspace | null;
  isConnected: boolean;
  activeUsers: string[];
  connectionHealth: ConnectionStatus;
  lastError: Error | null;
  reconnectAttempts: number;
}

/**
 * Interface for collaboration event data
 */
interface CollaborationEvent {
  type: string;
  payload: any;
  userId: string;
  workspaceId: string;
  eventTime: number;
  correlationId: string;
}

/**
 * Interface for connection health monitoring
 */
interface ConnectionStatus {
  isHealthy: boolean;
  latency: number;
  messageQueueSize: number;
  lastHeartbeat: number;
}

/**
 * Interface for workspace collaboration options
 */
interface WorkspaceOptions {
  autoConnect?: boolean;
  enablePresence?: boolean;
  batchUpdates?: boolean;
  heartbeatInterval?: number;
}

/**
 * Custom hook for managing real-time collaboration in workspaces
 */
export const useCollaboration = (
  workspaceId: string,
  options: WorkspaceOptions = {}
) => {
  // Initialize services
  const webSocketService = new WebSocketService();
  const workspaceService = new WorkspaceService(webSocketService);
  const analyticsService = new AnalyticsService();

  // State management
  const [state, setState] = useState<CollaborationState>({
    workspace: null,
    isConnected: false,
    activeUsers: [],
    connectionHealth: {
      isHealthy: false,
      latency: 0,
      messageQueueSize: 0,
      lastHeartbeat: Date.now()
    },
    lastError: null,
    reconnectAttempts: 0
  });

  /**
   * Handles workspace join with access validation
   */
  const joinWorkspace = useCallback(async () => {
    try {
      const workspace = await workspaceService.getWorkspace(workspaceId);
      
      // Validate user access
      await workspaceService.validateUserAccess(workspaceId);

      // Initialize WebSocket connection
      await webSocketService.connect();
      
      setState(prev => ({
        ...prev,
        workspace,
        isConnected: true
      }));

      // Track analytics
      analyticsService.trackCollaborationEvent({
        type: 'workspace_join',
        workspaceId,
        timestamp: new Date()
      });
    } catch (error) {
      ErrorHandler.handleWebSocketError(error);
      setState(prev => ({ ...prev, lastError: error as Error }));
    }
  }, [workspaceId]);

  /**
   * Handles workspace updates with debouncing
   */
  const updateWorkspaceData = useCallback(
    debounce(async (data: Partial<Workspace>) => {
      try {
        const updatedWorkspace = await workspaceService.updateWorkspace(workspaceId, data);
        setState(prev => ({
          ...prev,
          workspace: updatedWorkspace
        }));

        // Emit update event
        webSocketService.emit('workspace_update', {
          type: 'update',
          workspaceId,
          data,
          timestamp: Date.now()
        });
      } catch (error) {
        ErrorHandler.handleWebSocketError(error);
        setState(prev => ({ ...prev, lastError: error as Error }));
      }
    }, DEBOUNCE_DELAY),
    [workspaceId]
  );

  /**
   * Sends collaboration events with batching support
   */
  const sendCollaborationEvent = useCallback(async (event: string, data: any) => {
    try {
      const collaborationEvent: CollaborationEvent = {
        type: event,
        payload: data,
        userId: state.workspace?.ownerId || '',
        workspaceId,
        eventTime: Date.now(),
        correlationId: `${workspaceId}-${Date.now()}`
      };

      if (options.batchUpdates) {
        webSocketService.emit('batch_event', collaborationEvent);
      } else {
        webSocketService.emit(event, collaborationEvent);
      }
    } catch (error) {
      ErrorHandler.logError(error);
      setState(prev => ({ ...prev, lastError: error as Error }));
    }
  }, [workspaceId, state.workspace]);

  /**
   * Handles workspace leave with cleanup
   */
  const leaveWorkspace = useCallback(() => {
    try {
      webSocketService.emit('workspace_leave', { workspaceId });
      webSocketService.disconnect();
      setState(prev => ({
        ...prev,
        isConnected: false,
        workspace: null
      }));
    } catch (error) {
      ErrorHandler.logError(error);
    }
  }, [workspaceId]);

  /**
   * Implements reconnection with exponential backoff
   */
  const reconnect = useCallback(async () => {
    if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setState(prev => ({
        ...prev,
        lastError: new Error('Max reconnection attempts reached')
      }));
      return;
    }

    try {
      const delay = RECONNECT_BASE_DELAY * Math.pow(2, state.reconnectAttempts);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      await webSocketService.reconnect();
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        reconnectAttempts: 0,
        lastError: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1,
        lastError: error as Error
      }));
    }
  }, [state.reconnectAttempts]);

  /**
   * Clears last error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, lastError: null }));
  }, []);

  // Setup WebSocket event listeners
  useEffect(() => {
    if (!workspaceId) return;

    // Subscribe to workspace events
    webSocketService.subscribe('workspace_update', (event: CollaborationEvent) => {
      if (event.workspaceId === workspaceId) {
        setState(prev => ({
          ...prev,
          workspace: { ...prev.workspace!, ...event.payload }
        }));
      }
    });

    // Monitor connection health
    const healthCheck = setInterval(() => {
      const status = webSocketService.getConnectionStatus();
      setState(prev => ({
        ...prev,
        connectionHealth: {
          isHealthy: status.connected,
          latency: status.latency,
          messageQueueSize: status.bufferSize,
          lastHeartbeat: Date.now()
        }
      }));
    }, options.heartbeatInterval || 30000);

    // Auto-connect if enabled
    if (options.autoConnect) {
      joinWorkspace();
    }

    // Cleanup
    return () => {
      clearInterval(healthCheck);
      leaveWorkspace();
    };
  }, [workspaceId]);

  return {
    workspace: state.workspace,
    isConnected: state.isConnected,
    activeUsers: state.activeUsers,
    connectionHealth: state.connectionHealth,
    lastError: state.lastError,
    joinWorkspace,
    leaveWorkspace,
    updateWorkspaceData,
    sendCollaborationEvent,
    reconnect,
    clearError
  };
};

export default useCollaboration;