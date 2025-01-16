/**
 * Redis cache configuration for the Prompts Portal backend services
 * Provides centralized cache management with environment-aware settings
 * @version 1.0.0
 */

import { CacheConfig } from '../interfaces/config.interface';

/**
 * Redis cache configuration with environment-specific settings and fallback values
 * Implements high-performance data caching layer as specified in system architecture
 * @see Technical Specification Section 4.3 - DATABASES & STORAGE
 */
export const cacheConfig: CacheConfig = {
  // Redis server hostname with development fallback
  host: process.env.REDIS_HOST || 'localhost',
  
  // Redis server port with standard port fallback
  port: Number(process.env.REDIS_PORT) || 6379,
  
  // Cache TTL in seconds with 1-hour fallback
  ttl: Number(process.env.REDIS_TTL) || 3600,
  
  // Redis authentication password
  password: process.env.REDIS_PASSWORD || '',
  
  // Cluster mode disabled by default for development
  cluster: process.env.REDIS_CLUSTER === 'true',
  
  // Maximum connection retry attempts
  maxRetries: Number(process.env.REDIS_MAX_RETRIES) || 3
};

/**
 * Validate cache configuration values to ensure they are within acceptable ranges
 * Throws error if critical configuration values are invalid
 */
const validateCacheConfig = () => {
  if (!cacheConfig.host) {
    throw new Error('Redis host configuration is required');
  }

  if (cacheConfig.port < 1 || cacheConfig.port > 65535) {
    throw new Error('Redis port must be between 1 and 65535');
  }

  if (cacheConfig.ttl < 0) {
    throw new Error('Cache TTL must be a positive number');
  }

  if (cacheConfig.maxRetries < 0) {
    throw new Error('Max retries must be a positive number');
  }
};

// Validate configuration on module load
validateCacheConfig();

export default cacheConfig;