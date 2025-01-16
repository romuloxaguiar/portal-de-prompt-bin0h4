/**
 * Message Queue Configuration
 * Defines and exports queue configuration settings for the Prompts Portal backend services
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { QueueConfig, QueueOptions } from '../interfaces/config.interface';

// Load environment variables
config();

/**
 * Loads and validates queue configuration from environment variables
 * Implements environment-specific settings with comprehensive validation
 * @throws Error if required configuration values are missing
 * @returns {QueueConfig} Validated queue configuration
 */
const loadQueueConfig = (): QueueConfig => {
  // Validate required environment variables
  if (!process.env.QUEUE_URL || !process.env.QUEUE_USERNAME || !process.env.QUEUE_PASSWORD) {
    throw new Error('Missing required queue configuration environment variables');
  }

  // Construct queue URL with credentials
  const queueUrl = `amqp://${process.env.QUEUE_USERNAME}:${process.env.QUEUE_PASSWORD}@${process.env.QUEUE_URL}`;

  // Environment-specific queue options
  const queueOptions: QueueOptions = {
    // Heartbeat intervals - shorter in dev for faster feedback
    heartbeat: process.env.NODE_ENV === 'production' ? 60 : 30,

    // Prefetch counts - higher in production for better throughput
    prefetch: process.env.NODE_ENV === 'production' ? 100 : 10,

    // Always enable persistence and durability for message reliability
    persistent: true,
    durable: true,

    // Dead letter exchange for failed messages
    deadLetterExchange: process.env.QUEUE_DLX || 'prompts-portal-dlx',

    // Maximum priority level for message processing
    maxPriority: parseInt(process.env.QUEUE_MAX_PRIORITY || '10', 10)
  };

  // Construct complete queue configuration
  const queueConfig: QueueConfig = {
    url: queueUrl,
    options: queueOptions,
    exchange: process.env.QUEUE_EXCHANGE || 'prompts-portal',
    routingKey: process.env.QUEUE_ROUTING_KEY || 'prompts.events.#'
  };

  return queueConfig;
};

/**
 * Exported queue configuration instance
 * Used by services for message queue connections and event handling
 * @type {QueueConfig}
 */
export const queueConfig = loadQueueConfig();

/**
 * Re-export configuration interfaces for type safety
 */
export type { QueueConfig, QueueOptions };