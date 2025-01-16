/**
 * WebSocket server configuration for real-time collaboration features
 * Provides optimized settings for sub-2-second response times and secure connections
 * @version 1.0.0
 */

import { ServerOptions } from 'socket.io'; // ^4.7.0
import { AppConfig } from '../../../common/interfaces/config.interface';

/**
 * Comprehensive interface defining socket server configuration options
 * Extends Socket.IO ServerOptions with performance-optimized parameters
 */
export interface SocketConfig extends ServerOptions {
  /** WebSocket endpoint path */
  path: string;
  
  /** Whether to serve client files */
  serveClient: boolean;
  
  /** Ping interval in milliseconds for connection health checks */
  pingInterval: number;
  
  /** Ping timeout in milliseconds before connection is considered lost */
  pingTimeout: number;
  
  /** Initial connection timeout in milliseconds */
  connectTimeout: number;
  
  /** Maximum HTTP buffer size in bytes for messages */
  maxHttpBufferSize: number;
  
  /** Allowed transport methods in order of preference */
  transports: string[];
  
  /** Whether to allow transport upgrades */
  allowUpgrades: boolean;
  
  /** CORS configuration for WebSocket connections */
  cors: {
    origin: string | string[];
    methods: string[];
    credentials: boolean;
  };
}

/**
 * Default socket configuration with optimized settings for performance and security
 * - Sub-2-second response times achieved through optimized timeouts and buffer sizes
 * - WebSocket preferred with polling fallback for reliability
 * - Secure CORS configuration with credentials support
 */
export const socketConfig: SocketConfig = {
  path: '/socket.io',
  serveClient: false, // Disable serving client files for security
  
  // Optimized intervals for fast connection detection
  pingInterval: 10000, // 10 second ping interval
  pingTimeout: 5000,   // 5 second timeout for lost connections
  connectTimeout: 45000, // 45 second initial connection timeout
  
  // Optimized buffer size for typical collaboration payloads
  maxHttpBufferSize: 1e6, // 1MB max message size
  
  // Transport configuration prioritizing WebSocket
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  
  // CORS configuration using application settings
  cors: {
    origin: '${corsOrigins}', // Configured from AppConfig.corsOrigins
    methods: ['GET', 'POST'],
    credentials: true
  }
};