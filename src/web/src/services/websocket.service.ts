import { Socket } from 'socket.io-client'; // socket.io-client@^4.7.0
import {
    SOCKET_EVENTS,
    WebSocketOptions,
    WebSocketError,
    ConnectionStatus,
    createWebSocketConnection,
    validateSocketConnection,
    handleSocketError,
    ErrorCategory,
    ErrorSeverity
} from '../utils/websocket.util';
import { appConfig } from '../config/app.config';

/**
 * Interface for pending events during offline/reconnection
 */
interface PendingEvent {
    event: string;
    data: any;
    timestamp: number;
    retryCount: number;
}

/**
 * Queue implementation for managing pending events
 */
class EventQueue {
    private queue: PendingEvent[] = [];
    private readonly maxSize: number = 1000;

    enqueue(event: PendingEvent): void {
        if (this.queue.length >= this.maxSize) {
            this.queue.shift(); // Remove oldest event if queue is full
        }
        this.queue.push(event);
    }

    dequeue(): PendingEvent | undefined {
        return this.queue.shift();
    }

    clear(): void {
        this.queue = [];
    }

    get size(): number {
        return this.queue.length;
    }
}

/**
 * WebSocket service for managing real-time communication
 * Implements comprehensive connection management, error handling, and event optimization
 */
export class WebSocketService {
    private socket: Socket | null = null;
    private options: WebSocketOptions;
    private readonly eventHandlers: Map<string, Function[]>;
    private isReconnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly eventQueue: EventQueue;
    private healthCheckInterval?: NodeJS.Timeout;
    private readonly batchSize: number = 10;
    private batchTimeout?: NodeJS.Timeout;
    private pendingBatch: any[] = [];

    constructor() {
        this.eventHandlers = new Map();
        this.eventQueue = new EventQueue();
        this.options = {
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
    }

    /**
     * Establishes WebSocket connection with automatic retry and health monitoring
     * @param url WebSocket server URL
     * @param options Optional WebSocket configuration
     * @returns Promise resolving to connection success status
     */
    public async connect(url: string, options?: Partial<WebSocketOptions>): Promise<boolean> {
        try {
            if (this.socket?.connected) {
                return true;
            }

            this.options = { ...this.options, ...options };
            const wsUrl = url || `${appConfig.api.baseUrl}/collaboration`;

            this.socket = createWebSocketConnection(wsUrl, this.options);
            this.setupEventHandlers();
            this.startHealthCheck();

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.options.timeout);

                this.socket?.once(SOCKET_EVENTS.CONNECT, () => {
                    clearTimeout(timeout);
                    this.processQueuedEvents();
                    resolve(true);
                });

                this.socket?.once(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
        } catch (error) {
            const wsError = handleSocketError(error as Error, { url });
            throw wsError;
        }
    }

    /**
     * Gracefully closes the WebSocket connection with cleanup
     */
    public disconnect(): void {
        this.stopHealthCheck();
        this.clearBatchTimeout();
        this.eventQueue.clear();
        this.eventHandlers.clear();
        
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close();
            this.socket = null;
        }
        
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
    }

    /**
     * Subscribes to WebSocket events with enhanced error handling
     * @param event Event name to subscribe to
     * @param handler Event handler function
     */
    public subscribe(event: string, handler: Function): void {
        if (!this.socket) {
            throw new Error('Socket connection not established');
        }

        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }

        const handlers = this.eventHandlers.get(event)!;
        if (!handlers.includes(handler)) {
            handlers.push(handler);
            this.socket.on(event, (...args: any[]) => {
                try {
                    handler(...args);
                } catch (error) {
                    handleSocketError(error as Error, { event, args });
                }
            });
        }
    }

    /**
     * Safely unsubscribes from WebSocket events with cleanup
     * @param event Event name to unsubscribe from
     * @param handler Event handler function to remove
     */
    public unsubscribe(event: string, handler: Function): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
                if (handlers.length === 0) {
                    this.eventHandlers.delete(event);
                    this.socket?.off(event);
                }
            }
        }
    }

    /**
     * Emits events with batching and offline queuing support
     * @param event Event name to emit
     * @param data Event data
     */
    public emit(event: string, data: any): void {
        if (!this.socket?.connected) {
            this.queueEvent(event, data);
            return;
        }

        if (this.options.batchMessages) {
            this.addToBatch(event, data);
        } else {
            this.socket.emit(event, data, (error: any) => {
                if (error) {
                    handleSocketError(error, { event, data });
                }
            });
        }
    }

    /**
     * Checks connection status with health verification
     * @returns Detailed connection status
     */
    public isConnected(): boolean {
        if (!this.socket) {
            return false;
        }

        const status = validateSocketConnection(this.socket);
        return status.connected && !this.isReconnecting;
    }

    /**
     * Sets up core WebSocket event handlers
     * @private
     */
    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
            if (reason === 'io server disconnect') {
                this.reconnectAttempts = 0;
                this.connect(this.socket?.io.uri || '');
            }
        });

        this.socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, () => {
            this.isReconnecting = true;
            this.reconnectAttempts++;
        });

        this.socket.on(SOCKET_EVENTS.RECONNECT, () => {
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.processQueuedEvents();
        });

        this.socket.on(SOCKET_EVENTS.ERROR, (error: Error) => {
            handleSocketError(error, {
                reconnecting: this.isReconnecting,
                attempts: this.reconnectAttempts
            });
        });
    }

    /**
     * Starts connection health monitoring
     * @private
     */
    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            if (this.socket?.connected) {
                this.socket.emit(SOCKET_EVENTS.PING);
            }
        }, this.options.pingInterval);
    }

    /**
     * Stops connection health monitoring
     * @private
     */
    private stopHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }

    /**
     * Queues events for offline handling
     * @private
     */
    private queueEvent(event: string, data: any): void {
        this.eventQueue.enqueue({
            event,
            data,
            timestamp: Date.now(),
            retryCount: 0
        });
    }

    /**
     * Processes queued events upon reconnection
     * @private
     */
    private processQueuedEvents(): void {
        while (this.eventQueue.size > 0) {
            const event = this.eventQueue.dequeue();
            if (event) {
                this.emit(event.event, event.data);
            }
        }
    }

    /**
     * Adds event to batch for optimized transmission
     * @private
     */
    private addToBatch(event: string, data: any): void {
        this.pendingBatch.push({ event, data });

        if (this.pendingBatch.length >= this.batchSize) {
            this.flushBatch();
        } else if (!this.batchTimeout) {
            this.batchTimeout = setTimeout(() => this.flushBatch(), this.options.batchInterval);
        }
    }

    /**
     * Flushes pending event batch
     * @private
     */
    private flushBatch(): void {
        if (this.pendingBatch.length > 0) {
            this.socket?.emit('batch', this.pendingBatch, (error: any) => {
                if (error) {
                    handleSocketError(error, { batch: this.pendingBatch });
                }
            });
            this.pendingBatch = [];
        }
        this.clearBatchTimeout();
    }

    /**
     * Clears batch timeout
     * @private
     */
    private clearBatchTimeout(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = undefined;
        }
    }
}

export default WebSocketService;