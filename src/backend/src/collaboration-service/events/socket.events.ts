/**
 * @fileoverview Socket event constants and type definitions for real-time collaboration features
 * @version 1.0.0
 * @package @prompts-portal/collaboration-service
 */

import { Socket } from 'socket.io'; // ^4.7.0

/**
 * Standardized socket event type constants using domain:action pattern
 * @enum {string}
 */
export enum SOCKET_EVENTS {
  /** Socket connection event */
  CONNECT = 'connect',
  
  /** Socket disconnection event */
  DISCONNECT = 'disconnect',
  
  /** Workspace join event */
  JOIN_WORKSPACE = 'workspace:join',
  
  /** Workspace leave event */
  LEAVE_WORKSPACE = 'workspace:leave',
  
  /** Prompt update event */
  PROMPT_UPDATE = 'prompt:update',
  
  /** User presence update event */
  USER_PRESENCE = 'user:presence',
  
  /** Error event */
  ERROR = 'error'
}

/**
 * Interface for workspace join event data with team-based access control
 * @interface WorkspaceJoinData
 */
export interface WorkspaceJoinData {
  /** Unique identifier of the workspace */
  workspaceId: string;
  
  /** Unique identifier of the joining user */
  userId: string;
  
  /** Unique identifier of the team the workspace belongs to */
  teamId: string;
}

/**
 * Interface for prompt update event data with version control support
 * @interface PromptUpdateData
 */
export interface PromptUpdateData {
  /** Unique identifier of the prompt being updated */
  promptId: string;
  
  /** Workspace identifier where the prompt exists */
  workspaceId: string;
  
  /** Object containing the changes made to the prompt */
  changes: {
    content?: string;
    title?: string;
    variables?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  
  /** Version number for optimistic concurrency control */
  version: number;
}

/**
 * Interface for user presence event data with activity tracking
 * @interface UserPresenceData
 */
export interface UserPresenceData {
  /** Unique identifier of the user */
  userId: string;
  
  /** Workspace identifier where the user is present */
  workspaceId: string;
  
  /** Current user status (online, away, offline) */
  status: 'online' | 'away' | 'offline';
  
  /** Timestamp of last user activity */
  lastActivity: Date;
}

/**
 * Type definition for socket error event data
 * @interface SocketErrorData
 */
export interface SocketErrorData {
  /** Error code for categorization */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Type definition for socket event handlers
 * @interface SocketEventHandlers
 */
export interface SocketEventHandlers {
  [SOCKET_EVENTS.JOIN_WORKSPACE]: (data: WorkspaceJoinData) => void;
  [SOCKET_EVENTS.LEAVE_WORKSPACE]: (data: Pick<WorkspaceJoinData, 'workspaceId' | 'userId'>) => void;
  [SOCKET_EVENTS.PROMPT_UPDATE]: (data: PromptUpdateData) => void;
  [SOCKET_EVENTS.USER_PRESENCE]: (data: UserPresenceData) => void;
  [SOCKET_EVENTS.ERROR]: (data: SocketErrorData) => void;
}

/**
 * Type definition for typed socket instance
 * @type TypedSocket
 */
export type TypedSocket = Socket & {
  on: <E extends keyof SocketEventHandlers>(
    event: E,
    listener: SocketEventHandlers[E]
  ) => TypedSocket;
  emit: <E extends keyof SocketEventHandlers>(
    event: E,
    data: Parameters<SocketEventHandlers[E]>[0]
  ) => boolean;
};