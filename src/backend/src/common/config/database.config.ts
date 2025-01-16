/**
 * Database configuration for Prompts Portal backend services
 * Configures Cosmos DB connection settings with environment-specific parameters
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { DatabaseConfig, DatabaseOptions } from '../interfaces/config.interface';

// Load environment variables
config();

/**
 * Validates database configuration settings and environment variables
 * @param config Database configuration object to validate
 * @returns boolean indicating validation result
 */
const validateConfig = (config: DatabaseConfig): boolean => {
  if (!config.uri || !config.name) {
    throw new Error('Database URI and name are required');
  }

  if (!config.options.connectionTimeout || !config.options.requestTimeout) {
    throw new Error('Database timeout settings are required');
  }

  if (process.env.NODE_ENV === 'production' && !config.replicaRegions?.length) {
    throw new Error('Production environment requires replica regions configuration');
  }

  return true;
};

/**
 * Loads environment-specific database configuration
 * Supports multi-region deployment and failover for production environment
 * @returns DatabaseConfig Validated database configuration object
 */
const loadDatabaseConfig = (): DatabaseConfig => {
  const isProd = process.env.NODE_ENV === 'production';
  const isStaging = process.env.NODE_ENV === 'staging';

  // Base database options
  const dbOptions: DatabaseOptions = {
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10),
    consistencyLevel: isProd ? 'Session' : 'Eventual',
    enableBackup: isProd || isStaging
  };

  // Environment-specific configuration
  const config: DatabaseConfig = {
    uri: process.env.COSMOS_DB_URI || '',
    name: process.env.COSMOS_DB_NAME || 'prompts-portal',
    options: dbOptions,
    region: process.env.COSMOS_DB_PRIMARY_REGION || 'eastus',
    replicaRegions: []
  };

  // Configure multi-region support for production
  if (isProd) {
    config.replicaRegions = [
      process.env.COSMOS_DB_SECONDARY_REGION || 'westus',
      process.env.COSMOS_DB_DR_REGION || 'northeurope'
    ];
  }
  // Configure single region replication for staging
  else if (isStaging) {
    config.replicaRegions = [
      process.env.COSMOS_DB_SECONDARY_REGION || 'westus'
    ];
  }

  // Validate configuration
  validateConfig(config);

  return config;
};

/**
 * Exported database configuration instance
 * Contains environment-specific settings for Cosmos DB connection
 */
export const databaseConfig = {
  ...loadDatabaseConfig(),
  // Additional configuration properties
  consistency: {
    level: process.env.NODE_ENV === 'production' ? 'Session' : 'Eventual',
    maxStalenessPrefix: 100,
    maxIntervalInSeconds: 5
  },
  backup: {
    enabled: process.env.NODE_ENV !== 'development',
    intervalHours: 24,
    retentionDays: 30,
    type: 'Periodic'
  },
  connectionPolicy: {
    enableEndpointDiscovery: true,
    preferredLocations: loadDatabaseConfig().replicaRegions,
    retryOptions: {
      maxRetries: parseInt(process.env.DB_MAX_RETRIES || '3', 10),
      fixedRetryIntervalInMilliseconds: 500,
      maxWaitTimeInSeconds: 30
    }
  }
};