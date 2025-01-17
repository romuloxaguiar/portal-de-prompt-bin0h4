/**
 * AI Model Provider Configuration
 * Defines comprehensive settings for AI model integrations including rate limits,
 * timeouts, and error handling strategies
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.3
import { AppConfig } from '../../../common/interfaces/config.interface';

// Load environment variables
config();

/**
 * Supported AI model providers
 */
export enum AIModelProvider {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
  GOOGLE_AI = 'GOOGLE_AI'
}

/**
 * Default timeout and retry settings
 */
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CONCURRENT_REQUESTS = 50;

/**
 * Provider-specific rate limits (requests per minute)
 */
const RATE_LIMIT_CONFIG = {
  [AIModelProvider.OPENAI]: {
    requestsPerMinute: 3500,
    burstLimit: 3750,
    concurrentRequests: DEFAULT_CONCURRENT_REQUESTS
  },
  [AIModelProvider.ANTHROPIC]: {
    requestsPerMinute: 2500,
    burstLimit: 2750,
    concurrentRequests: DEFAULT_CONCURRENT_REQUESTS
  },
  [AIModelProvider.GOOGLE_AI]: {
    requestsPerMinute: 3000,
    burstLimit: 3250,
    concurrentRequests: DEFAULT_CONCURRENT_REQUESTS
  }
};

/**
 * AI model configuration interface
 */
interface AIModelConfig {
  apiVersion: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
    concurrentRequests: number;
  };
  models: {
    supported: string[];
    defaults: {
      temperature: number;
      maxTokens: number;
      topP: number;
    };
    capabilities: {
      streaming: boolean;
      functionCalling: boolean;
      toolUse: boolean;
    };
  };
  errorHandling: {
    retryableErrors: string[];
    errorMappings: Record<string, string>;
  };
}

/**
 * Validates provider configuration
 */
function validateConfig(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function(...args: any[]) {
    const provider = args[0];
    if (!Object.values(AIModelProvider).includes(provider)) {
      throw new Error(`Invalid AI provider: ${provider}`);
    }
    return originalMethod.apply(this, args);
  };
  return descriptor;
}

/**
 * Retrieves provider-specific configuration
 */
@validateConfig
function getProviderConfig(provider: AIModelProvider): AIModelConfig {
  const timeout = parseInt(process.env.AI_REQUEST_TIMEOUT || '') || DEFAULT_TIMEOUT;
  const maxRetries = parseInt(process.env.AI_MAX_RETRIES || '') || DEFAULT_MAX_RETRIES;

  const baseConfigs: Record<AIModelProvider, Partial<AIModelConfig>> = {
    [AIModelProvider.OPENAI]: {
      apiVersion: 'v1',
      baseUrl: 'https://api.openai.com/v1',
      models: {
        supported: ['gpt-4', 'gpt-3.5-turbo'],
        defaults: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 1
        },
        capabilities: {
          streaming: true,
          functionCalling: true,
          toolUse: true
        }
      },
      errorHandling: {
        retryableErrors: ['rate_limit_exceeded', 'service_unavailable'],
        errorMappings: {
          'context_length_exceeded': 'Prompt exceeds maximum token limit',
          'invalid_api_key': 'Invalid OpenAI API key'
        }
      }
    },
    [AIModelProvider.ANTHROPIC]: {
      apiVersion: 'v1',
      baseUrl: 'https://api.anthropic.com/v1',
      models: {
        supported: ['claude-2', 'claude-instant'],
        defaults: {
          temperature: 0.7,
          maxTokens: 4096,
          topP: 1
        },
        capabilities: {
          streaming: true,
          functionCalling: false,
          toolUse: false
        }
      },
      errorHandling: {
        retryableErrors: ['rate_limit', 'server_error'],
        errorMappings: {
          'context_length': 'Prompt exceeds maximum token limit',
          'invalid_api_key': 'Invalid Anthropic API key'
        }
      }
    },
    [AIModelProvider.GOOGLE_AI]: {
      apiVersion: 'v1',
      baseUrl: 'https://api.googleapis.com/v1/models',
      models: {
        supported: ['text-bison-001', 'chat-bison-001'],
        defaults: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 1
        },
        capabilities: {
          streaming: true,
          functionCalling: false,
          toolUse: false
        }
      },
      errorHandling: {
        retryableErrors: ['quota_exceeded', 'internal'],
        errorMappings: {
          'invalid_argument': 'Invalid request parameters',
          'permission_denied': 'Invalid Google AI API key'
        }
      }
    }
  };

  return {
    ...baseConfigs[provider],
    timeout,
    maxRetries,
    rateLimit: RATE_LIMIT_CONFIG[provider]
  } as AIModelConfig;
}

/**
 * Export comprehensive AI model configuration
 */
export const AIModelsConfig = {
  providers: {
    [AIModelProvider.OPENAI]: getProviderConfig(AIModelProvider.OPENAI),
    [AIModelProvider.ANTHROPIC]: getProviderConfig(AIModelProvider.ANTHROPIC),
    [AIModelProvider.GOOGLE_AI]: getProviderConfig(AIModelProvider.GOOGLE_AI)
  }
};

export default AIModelsConfig;