/**
 * Configuration interfaces for the Prompts Portal backend services
 * Provides type safety and validation for application, cache, database and queue configurations
 * @version 1.0.0
 */

/**
 * Application-wide configuration settings interface
 * Defines core application parameters including environment, API, security and performance settings
 */
export interface AppConfig {
  /** HTTP port the application listens on */
  port: number;
  
  /** Runtime environment (development, staging, production) */
  env: string;
  
  /** API version string (e.g. v1) */
  apiVersion: string;
  
  /** Allowed CORS origins */
  corsOrigins: string[];
  
  /** Application logging level */
  logLevel: string;
  
  /** Rate limiting configuration */
  rateLimits: {
    /** Requests per window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Enable/disable rate limiting */
    enabled: boolean;
  };
}

/**
 * Redis cache configuration interface
 * Defines settings for Redis cache including connection, security and performance options
 */
export interface CacheConfig {
  /** Redis host address */
  host: string;
  
  /** Redis port number */
  port: number;
  
  /** Default TTL in seconds */
  ttl: number;
  
  /** Redis auth password */
  password: string;
  
  /** Enable cluster mode */
  cluster: boolean;
  
  /** Max connection retry attempts */
  maxRetries: number;
}

/**
 * Cosmos DB configuration interface
 * Defines settings for database including connection, replication and performance options
 */
export interface DatabaseConfig {
  /** Database connection URI */
  uri: string;
  
  /** Database name */
  name: string;
  
  /** Database connection options */
  options: DatabaseOptions;
  
  /** Primary region */
  region: string;
  
  /** Replica regions for geo-replication */
  replicaRegions: string[];
}

/**
 * Message queue configuration interface
 * Defines settings for message queues including connection, routing and reliability options
 */
export interface QueueConfig {
  /** Queue connection URL */
  url: string;
  
  /** Queue connection and behavior options */
  options: QueueOptions;
  
  /** Exchange name */
  exchange: string;
  
  /** Routing key pattern */
  routingKey: string;
}

/**
 * Detailed database connection options interface
 * Defines granular settings for database connections including timeouts and consistency
 */
export interface DatabaseOptions {
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  
  /** Request timeout in milliseconds */
  requestTimeout: number;
  
  /** Max retry attempts for operations */
  maxRetries: number;
  
  /** Consistency level for operations */
  consistencyLevel: string;
  
  /** Enable automatic backups */
  enableBackup: boolean;
}

/**
 * Detailed message queue options interface
 * Defines granular settings for queue behavior including reliability and performance
 */
export interface QueueOptions {
  /** Heartbeat interval in seconds */
  heartbeat: number;
  
  /** Number of messages to prefetch */
  prefetch: number;
  
  /** Enable message persistence */
  persistent: boolean;
  
  /** Enable queue durability */
  durable: boolean;
  
  /** Dead letter exchange name */
  deadLetterExchange: string;
  
  /** Maximum message priority level */
  maxPriority: number;
}