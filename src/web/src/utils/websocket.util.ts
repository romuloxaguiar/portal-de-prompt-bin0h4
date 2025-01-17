import { io, Socket } from 'socket.io-client'; // socket.io-client@^4.7.0

// Comprehensive WebSocket event types
export enum SOCKET_EVENTS {
    CONNECT = 'connect',
    DISCONNECT = 'disconnect',
    ERROR = 'error',
    RECONNECT = 'reconnect',
    RECONNECT_ATTEMPT = 'reconnect_attempt',
    RECONNECT_ERROR = 'reconnect_error',
    RECONNECT_FAILED = 'reconnect_failed',
    MESSAGE = 'message',
    PING = 'ping',
    PONG = 'pong',
    CONNECT_ERROR = 'connect_error',
    CONNECT_TIMEOUT = 'connect_timeout'
}

// Error severity levels for detailed error handling
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

// Error categories for better error classification
export enum ErrorCategory {
    CONNECTION = 'connection',
    AUTHENTICATION = 'authentication',
    TIMEOUT = 'timeout',
    PROTOCOL = 'protocol',
    NETWORK = 'network',
    UNKNOWN = 'unknown'
}

// Comprehensive WebSocket configuration options
export interface WebSocketOptions {
    autoConnect: boolean;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    timeout: number;
    pingInterval: number;
    pingTimeout: number;
    transports: string[];
    secure: boolean;
    rejectUnauthorized: boolean;
    maxRetries: number;
    batchMessages: boolean;
    batchInterval: number;
}

// Enhanced error interface with detailed metadata
export interface WebSocketError {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    metadata: Record<string, unknown>;
    timestamp: string;
    connectionId: string;
    context: Record<string, unknown>;
}

// Connection status interface for health checks
export interface ConnectionStatus {
    connected: boolean;
    authenticated: boolean;
    lastPingTime: number;
    transport: string;
    bufferSize: number;
    reconnectAttempts: number;
    latency: number;
}

// Default WebSocket configuration
const DEFAULT_WEBSOCKET_OPTIONS: WebSocketOptions = {
    autoConnect: false,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    pingInterval: 25000,
    pingTimeout: 5000,
    transports: ['websocket'],
    secure: true,
    rejectUnauthorized: true,
    maxRetries: 3,
    batchMessages: true,
    batchInterval: 100
};

/**
 * Creates and configures a new WebSocket connection with comprehensive error handling
 * @param url WebSocket server URL
 * @param options Configuration options
 * @returns Configured Socket.io client instance
 */
export const createWebSocketConnection = (
    url: string,
    options: Partial<WebSocketOptions> = {}
): Socket => {
    // Validate URL
    if (!url || !url.trim()) {
        throw new Error('Invalid WebSocket URL provided');
    }

    // Merge options with defaults
    const finalOptions: WebSocketOptions = {
        ...DEFAULT_WEBSOCKET_OPTIONS,
        ...options
    };

    // Initialize socket with merged options
    const socket: Socket = io(url, {
        ...finalOptions,
        auth: {
            timestamp: Date.now()
        }
    });

    // Configure connection lifecycle handlers
    socket.on(SOCKET_EVENTS.CONNECT, () => {
        console.info(`WebSocket connected to ${url}`);
    });

    socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
        console.warn(`WebSocket disconnected: ${reason}`);
    });

    socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
        handleSocketError(error, { connectionUrl: url });
    });

    // Configure ping/pong monitoring
    let lastPingTime = Date.now();
    socket.on(SOCKET_EVENTS.PING, () => {
        lastPingTime = Date.now();
    });

    // Message batching implementation
    if (finalOptions.batchMessages) {
        let messageQueue: any[] = [];
        let batchTimeout: NodeJS.Timeout | null = null;

        const flushMessageQueue = () => {
            if (messageQueue.length > 0) {
                socket.emit('batch', messageQueue);
                messageQueue = [];
            }
            batchTimeout = null;
        };

        socket.onAny((event, ...args) => {
            messageQueue.push({ event, args });
            if (!batchTimeout) {
                batchTimeout = setTimeout(flushMessageQueue, finalOptions.batchInterval);
            }
        });
    }

    return socket;
};

/**
 * Validates WebSocket connection status with detailed health checks
 * @param socket Socket instance to validate
 * @returns Detailed connection status
 */
export const validateSocketConnection = (socket: Socket): ConnectionStatus => {
    if (!socket) {
        throw new Error('Invalid socket instance provided');
    }

    const status: ConnectionStatus = {
        connected: socket.connected,
        authenticated: socket.auth !== undefined,
        lastPingTime: Date.now(),
        transport: socket.io.engine?.transport.name || 'unknown',
        bufferSize: (socket as any)._buffer?.length || 0,
        reconnectAttempts: (socket as any)._reconnectionAttempts || 0,
        latency: (socket as any)._latency || 0
    };

    return status;
};

/**
 * Enhanced error handling with detailed error categorization
 * @param error Error object
 * @param context Additional error context
 * @returns Formatted WebSocket error
 */
export const handleSocketError = (
    error: Error,
    context: Record<string, unknown> = {}
): WebSocketError => {
    const errorCode = (error as any).code || 'UNKNOWN_ERROR';
    
    // Categorize error
    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;

    if (errorCode.includes('ECONNREFUSED') || errorCode.includes('CONNECT')) {
        category = ErrorCategory.CONNECTION;
        severity = ErrorSeverity.HIGH;
    } else if (errorCode.includes('AUTH')) {
        category = ErrorCategory.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
    } else if (errorCode.includes('TIMEOUT')) {
        category = ErrorCategory.TIMEOUT;
        severity = ErrorSeverity.MEDIUM;
    }

    const websocketError: WebSocketError = {
        code: errorCode,
        message: error.message,
        category,
        severity,
        metadata: {
            stack: error.stack,
            name: error.name
        },
        timestamp: new Date().toISOString(),
        connectionId: (context.connectionId as string) || `ws-${Date.now()}`,
        context
    };

    // Log error for monitoring
    console.error('WebSocket Error:', websocketError);

    return websocketError;
};