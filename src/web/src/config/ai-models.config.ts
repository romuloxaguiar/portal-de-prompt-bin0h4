/**
 * AI Models Configuration
 * Version: 1.0.0
 * 
 * Defines supported AI model providers, their specifications, and integration settings
 * for the Prompts Portal platform frontend application.
 */

// Interfaces
export interface AIProviderConfig {
  name: string;
  displayName: string;
  apiVersion: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  models: Record<string, AIModel>;
  isEnabled: boolean;
  rateLimits: RateLimits;
  errorHandling: ErrorHandling;
  supportedFeatures: string[];
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  temperature: number;
  supportedFeatures: string[];
  pricing: {
    inputPerToken: number;
    outputPerToken: number;
    currency: string;
  };
  performance: {
    averageLatency: number;
    throughput: number;
  };
  capabilities: string[];
  limits: {
    maxInputTokens: number;
    maxOutputTokens: number;
    maxTotalTokens: number;
  };
}

export interface RateLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  tokensPerMinute: number;
  burstLimit: {
    maxBurst: number;
    timeWindowMs: number;
  };
}

export interface ErrorHandling {
  retryStrategy: {
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  retryableErrors: string[];
  fallbackOptions: {
    timeout: number;
    fallbackProvider?: string;
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
  };
}

// Constants
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_TEMPERATURE = 0.7;
export const RATE_LIMIT_DEFAULT = {
  requestsPerMinute: 60,
  tokensPerMinute: 40000,
};
export const ERROR_HANDLING_CONFIG = {
  retryableStatusCodes: [408, 429, 502, 503, 504],
  circuitBreakerThreshold: 5,
};

// Provider Enum
export enum AIModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE_AI = 'google_ai',
}

// Utility Functions
export function getProviderConfig(provider: AIModelProvider): AIProviderConfig {
  if (!Object.values(AIModelProvider).includes(provider)) {
    throw new Error(`Invalid provider: ${provider}`);
  }

  const config = AIModelsConfig.providers[provider];
  if (!config) {
    throw new Error(`Configuration not found for provider: ${provider}`);
  }

  if (!validateProviderConfig(config)) {
    throw new Error(`Invalid configuration for provider: ${provider}`);
  }

  return config;
}

export function getModelConfig(provider: AIModelProvider, modelId: string): AIModel {
  const providerConfig = getProviderConfig(provider);
  const modelConfig = providerConfig.models[modelId];

  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found for provider ${provider}`);
  }

  return modelConfig;
}

export function validateProviderConfig(config: AIProviderConfig): boolean {
  const requiredFields = [
    'name',
    'baseUrl',
    'apiVersion',
    'models',
    'rateLimits',
    'errorHandling',
  ];

  return requiredFields.every((field) => config[field as keyof AIProviderConfig] !== undefined);
}

// Main Configuration
export const AIModelsConfig = {
  providers: {
    [AIModelProvider.OPENAI]: {
      name: 'OpenAI',
      displayName: 'OpenAI',
      apiVersion: 'v1',
      baseUrl: process.env.VITE_OPENAI_API_URL || 'https://api.openai.com',
      timeout: DEFAULT_TIMEOUT,
      maxRetries: DEFAULT_MAX_RETRIES,
      isEnabled: true,
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 3500,
        tokensPerMinute: 40000,
        burstLimit: {
          maxBurst: 100,
          timeWindowMs: 60000,
        },
      },
      errorHandling: {
        retryStrategy: {
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 1.5,
        },
        retryableErrors: ['rate_limit_exceeded', 'server_error', 'timeout'],
        fallbackOptions: {
          timeout: 5000,
        },
        circuitBreaker: {
          failureThreshold: ERROR_HANDLING_CONFIG.circuitBreakerThreshold,
          resetTimeoutMs: 30000,
        },
      },
      supportedFeatures: ['completion', 'chat', 'embedding', 'edit'],
      models: {
        'gpt-4': {
          id: 'gpt-4',
          name: 'GPT-4',
          description: 'Most capable GPT-4 model for various tasks',
          maxTokens: 8192,
          temperature: DEFAULT_TEMPERATURE,
          supportedFeatures: ['completion', 'chat'],
          pricing: {
            inputPerToken: 0.00003,
            outputPerToken: 0.00006,
            currency: 'USD',
          },
          performance: {
            averageLatency: 2000,
            throughput: 50,
          },
          capabilities: ['text_generation', 'code_generation', 'analysis'],
          limits: {
            maxInputTokens: 4096,
            maxOutputTokens: 4096,
            maxTotalTokens: 8192,
          },
        },
      },
    },
    [AIModelProvider.ANTHROPIC]: {
      name: 'Anthropic',
      displayName: 'Anthropic',
      apiVersion: 'v1',
      baseUrl: process.env.VITE_ANTHROPIC_API_URL || 'https://api.anthropic.com',
      timeout: DEFAULT_TIMEOUT,
      maxRetries: DEFAULT_MAX_RETRIES,
      isEnabled: true,
      rateLimits: {
        requestsPerMinute: 50,
        requestsPerHour: 3000,
        tokensPerMinute: 35000,
        burstLimit: {
          maxBurst: 80,
          timeWindowMs: 60000,
        },
      },
      errorHandling: {
        retryStrategy: {
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 1.5,
        },
        retryableErrors: ['rate_limit', 'server_error', 'timeout'],
        fallbackOptions: {
          timeout: 5000,
          fallbackProvider: AIModelProvider.OPENAI,
        },
        circuitBreaker: {
          failureThreshold: ERROR_HANDLING_CONFIG.circuitBreakerThreshold,
          resetTimeoutMs: 30000,
        },
      },
      supportedFeatures: ['completion', 'chat'],
      models: {
        'claude-2': {
          id: 'claude-2',
          name: 'Claude 2',
          description: 'Latest Claude model with enhanced capabilities',
          maxTokens: 100000,
          temperature: DEFAULT_TEMPERATURE,
          supportedFeatures: ['completion', 'chat'],
          pricing: {
            inputPerToken: 0.000008,
            outputPerToken: 0.000024,
            currency: 'USD',
          },
          performance: {
            averageLatency: 1800,
            throughput: 60,
          },
          capabilities: ['text_generation', 'analysis', 'coding'],
          limits: {
            maxInputTokens: 50000,
            maxOutputTokens: 50000,
            maxTotalTokens: 100000,
          },
        },
      },
    },
    [AIModelProvider.GOOGLE_AI]: {
      name: 'Google AI',
      displayName: 'Google AI',
      apiVersion: 'v1',
      baseUrl: process.env.VITE_GOOGLE_AI_API_URL || 'https://api.google.ai',
      timeout: DEFAULT_TIMEOUT,
      maxRetries: DEFAULT_MAX_RETRIES,
      isEnabled: true,
      rateLimits: {
        requestsPerMinute: 40,
        requestsPerHour: 2400,
        tokensPerMinute: 30000,
        burstLimit: {
          maxBurst: 60,
          timeWindowMs: 60000,
        },
      },
      errorHandling: {
        retryStrategy: {
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 1.5,
        },
        retryableErrors: ['quota_exceeded', 'server_error', 'timeout'],
        fallbackOptions: {
          timeout: 5000,
          fallbackProvider: AIModelProvider.OPENAI,
        },
        circuitBreaker: {
          failureThreshold: ERROR_HANDLING_CONFIG.circuitBreakerThreshold,
          resetTimeoutMs: 30000,
        },
      },
      supportedFeatures: ['completion', 'chat', 'embedding'],
      models: {
        'palm-2': {
          id: 'palm-2',
          name: 'PaLM 2',
          description: 'Google\'s advanced language model',
          maxTokens: 16384,
          temperature: DEFAULT_TEMPERATURE,
          supportedFeatures: ['completion', 'chat', 'embedding'],
          pricing: {
            inputPerToken: 0.000025,
            outputPerToken: 0.00005,
            currency: 'USD',
          },
          performance: {
            averageLatency: 1500,
            throughput: 70,
          },
          capabilities: ['text_generation', 'embedding', 'analysis'],
          limits: {
            maxInputTokens: 8192,
            maxOutputTokens: 8192,
            maxTotalTokens: 16384,
          },
        },
      },
    },
  },
} as const;

export default AIModelsConfig;