/**
 * Analytics Service Database Configuration
 * Configures Cloud Firestore settings for analytics data storage with optimized performance
 * and retention policies
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { DatabaseConfig, DatabaseOptions } from '../../common/interfaces/config.interface';

// Load environment variables
config();

/**
 * Analytics-specific database options extending base DatabaseOptions
 * Includes specialized settings for analytics data handling
 */
interface AnalyticsDatabaseOptions extends DatabaseOptions {
  /** Analytics data retention period in months */
  retentionPeriodMonths: number;
  
  /** Connection pool configuration */
  pool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
  };
  
  /** Query optimization settings */
  queryOptimization: {
    enableQueryCache: boolean;
    queryCacheTTLSeconds: number;
    enableAutomaticIndexing: boolean;
    maxQueryExecutionTimeSeconds: number;
  };
  
  /** Collection settings */
  collections: {
    metrics: string;
    reports: string;
    archives: string;
  };
}

/**
 * Loads and validates analytics database configuration
 * Implements specific settings for Cloud Firestore analytics data storage
 */
export function loadAnalyticsDatabaseConfig(): DatabaseConfig {
  // Validate required environment variables
  const requiredEnvVars = [
    'ANALYTICS_DB_URI',
    'ANALYTICS_DB_NAME',
    'ANALYTICS_DB_REGION'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Analytics-specific database options
  const analyticsOptions: AnalyticsDatabaseOptions = {
    // Base DatabaseOptions settings
    connectionTimeout: parseInt(process.env.ANALYTICS_DB_CONN_TIMEOUT || '30000'), // 30 seconds
    requestTimeout: parseInt(process.env.ANALYTICS_DB_REQ_TIMEOUT || '30000'),    // 30 seconds
    maxRetries: parseInt(process.env.ANALYTICS_DB_MAX_RETRIES || '3'),
    consistencyLevel: process.env.ANALYTICS_DB_CONSISTENCY || 'strong',
    enableBackup: true,

    // Analytics-specific settings
    retentionPeriodMonths: 36, // 36 months retention as per requirements

    // Connection pool settings
    pool: {
      min: parseInt(process.env.ANALYTICS_DB_POOL_MIN || '5'),
      max: parseInt(process.env.ANALYTICS_DB_POOL_MAX || '50'),
      acquireTimeoutMillis: 30000
    },

    // Query optimization settings
    queryOptimization: {
      enableQueryCache: true,
      queryCacheTTLSeconds: 300, // 5 minutes cache TTL
      enableAutomaticIndexing: true,
      maxQueryExecutionTimeSeconds: 30
    },

    // Collection names
    collections: {
      metrics: 'analytics_metrics',
      reports: 'analytics_reports',
      archives: 'analytics_archives'
    }
  };

  // Construct and return the complete database configuration
  const analyticsDatabaseConfig: DatabaseConfig = {
    uri: process.env.ANALYTICS_DB_URI!,
    name: process.env.ANALYTICS_DB_NAME!,
    options: analyticsOptions,
    region: process.env.ANALYTICS_DB_REGION!,
    replicaRegions: process.env.ANALYTICS_DB_REPLICA_REGIONS?.split(',') || []
  };

  return analyticsDatabaseConfig;
}

/**
 * Exported analytics database configuration instance
 * Pre-configured with optimized settings for analytics data storage
 */
export const analyticsDatabaseConfig = loadAnalyticsDatabaseConfig();

/**
 * Export collection names for use in models
 * Provides centralized collection name management
 */
export const ANALYTICS_COLLECTIONS = {
  METRICS: analyticsDatabaseConfig.options.collections.metrics,
  REPORTS: analyticsDatabaseConfig.options.collections.reports,
  ARCHIVES: analyticsDatabaseConfig.options.collections.archives
};

/**
 * Export retention policy settings
 * Used by cleanup and archival processes
 */
export const RETENTION_POLICY = {
  MONTHS: (analyticsDatabaseConfig.options as AnalyticsDatabaseOptions).retentionPeriodMonths,
  ARCHIVE_BATCH_SIZE: 1000,
  CLEANUP_INTERVAL_HOURS: 24
};