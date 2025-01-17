import { useState, useEffect, useCallback, useRef } from 'react'; // react@^18.0.0
import { Socket } from 'socket.io-client'; // socket.io-client@^4.7.0
import {
  SOCKET_EVENTS,
  createWebSocketConnection,
  validateSocketConnection,
  WebSocketOptions,
  WebSocketError,
  ConnectionStatus,
  ErrorCategory,
  ErrorSeverity
} from '../utils/websocket.util';

// Constants for configuration
const DEFAULT_CLEANUP_DELAY = 500;
const DEFAULT_RECONNECT_ATTEMPTS = 3;
const DEFAULT_BATCH_INTERVAL = 100;
const DEFAULT_HEALTH_CHECK_INTERVAL = 30000;

// Interface for connection statistics
interface ConnectionStats {
  latency: number;
  messagesSent: number;
  messagesReceived: number;
  reconnectAttempts: number;
  lastHealthCheck: Date;
  bufferSize: number;
}

// Interface for connection error
interface ConnectionError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: number;
  details?: any;
}

// Interface for hook return value
interface UseWebSocketReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  error: ConnectionError | null;
  stats: ConnectionStats;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string) => void;
  emit: (event: string, data: any) => void;
  checkHealth: () => ConnectionStatus;
}

/**
 * Enhanced custom hook for managing WebSocket connections with improved error handling,
 * connection monitoring, and performance optimizations.
 */
export const useWebSocket = (
  url: string,
  options: Partial<WebSocketOptions> = {}
): UseWebSocketReturn => {
  // Socket and connection state
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<ConnectionError | null>(null);

  // Connection statistics
  const [stats, setStats] = useState<ConnectionStats>({
    latency: 0,
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0,
    lastHealthCheck: new Date(),
    bufferSize: 0
  });

  // Message batching queue
  const messageQueueRef = useRef<Array<{ event: string; data: any }>>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized connect function with retry logic
  const connect = useCallback(async () => {
    try {
      if (socketRef.current?.connected) {
        return;
      }

      socketRef.current = createWebSocketConnection(url, {
        ...options,
        reconnectionAttempts: DEFAULT_RECONNECT_ATTEMPTS,
        batchInterval: DEFAULT_BATCH_INTERVAL
      });

      // Set up connection event handlers
      socketRef.current.on(SOCKET_EVENTS.CONNECT, () => {
        setIsConnected(true);
        setError(null);
        setStats(prev => ({
          ...prev,
          reconnectAttempts: 0,
          lastHealthCheck: new Date()
        }));
      });

      socketRef.current.on(SOCKET_EVENTS.DISCONNECT, () => {
        setIsConnected(false);
      });

      socketRef.current.on(SOCKET_EVENTS.ERROR, (err: any) => {
        const connectionError: ConnectionError = {
          code: err.code || 'UNKNOWN',
          message: err.message,
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.HIGH,
          timestamp: Date.now(),
          details: err
        };
        setError(connectionError);
      });

      socketRef.current.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attempt: number) => {
        setIsReconnecting(true);
        setStats(prev => ({
          ...prev,
          reconnectAttempts: attempt
        }));
      });

      // Connect the socket
      socketRef.current.connect();
    } catch (err: any) {
      setError({
        code: 'CONNECTION_FAILED',
        message: err.message,
        category: ErrorCategory.CONNECTION,
        severity: ErrorSeverity.HIGH,
        timestamp: Date.now(),
        details: err
      });
    }
  }, [url, options]);

  // Memoized disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setIsReconnecting(false);
    }
  }, []);

  // Memoized subscribe function
  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, (data: any) => {
        setStats(prev => ({
          ...prev,
          messagesReceived: prev.messagesReceived + 1
        }));
        callback(data);
      });
    }
  }, []);

  // Memoized unsubscribe function
  const unsubscribe = useCallback((event: string) => {
    if (socketRef.current) {
      socketRef.current.off(event);
    }
  }, []);

  // Memoized emit function with batching
  const emit = useCallback((event: string, data: any) => {
    if (!socketRef.current?.connected) {
      return;
    }

    if (options.batchMessages) {
      messageQueueRef.current.push({ event, data });

      if (!batchTimeoutRef.current) {
        batchTimeoutRef.current = setTimeout(() => {
          if (messageQueueRef.current.length > 0) {
            socketRef.current?.emit('batch', messageQueueRef.current);
            setStats(prev => ({
              ...prev,
              messagesSent: prev.messagesSent + messageQueueRef.current.length,
              bufferSize: 0
            }));
            messageQueueRef.current = [];
          }
          batchTimeoutRef.current = null;
        }, options.batchInterval || DEFAULT_BATCH_INTERVAL);
      }
    } else {
      socketRef.current.emit(event, data);
      setStats(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1
      }));
    }
  }, [options.batchMessages, options.batchInterval]);

  // Connection health check
  const checkHealth = useCallback((): ConnectionStatus => {
    if (!socketRef.current) {
      throw new Error('Socket connection not initialized');
    }
    const status = validateSocketConnection(socketRef.current);
    setStats(prev => ({
      ...prev,
      latency: status.latency,
      lastHealthCheck: new Date(),
      bufferSize: status.bufferSize
    }));
    return status;
  }, []);

  // Set up health check interval
  useEffect(() => {
    if (isConnected) {
      const healthCheckInterval = setInterval(() => {
        try {
          checkHealth();
        } catch (err) {
          console.error('Health check failed:', err);
        }
      }, DEFAULT_HEALTH_CHECK_INTERVAL);

      return () => clearInterval(healthCheckInterval);
    }
  }, [isConnected, checkHealth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      
      // Delay disconnect to allow pending operations to complete
      setTimeout(() => {
        disconnect();
      }, DEFAULT_CLEANUP_DELAY);
    };
  }, [disconnect]);

  return {
    isConnected,
    isReconnecting,
    error,
    stats,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    emit,
    checkHealth
  };
};