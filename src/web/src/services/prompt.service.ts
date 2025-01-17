/**
 * Frontend service responsible for managing prompt-related operations.
 * Implements comprehensive error handling, caching, analytics tracking, and retry logic.
 * @version 1.0.0
 */

import { apiService } from './api.service';
import { ErrorHandler } from '../utils/error.util';
import { AnalyticsTracker } from '../services/analytics.service';
import retry from 'axios-retry'; // ^3.5.0
import cacheManager from 'cache-manager'; // ^5.0.0
import { API_ENDPOINTS } from '../constants/api.constant';
import { ErrorCode } from '../constants/error.constant';
import { storage, StorageKeys } from '../utils/storage.util';
import { MetricType } from '../interfaces/analytics.interface';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_MAX_ITEMS = 100;

/**
 * Interface for prompt data structure
 */
interface IPrompt {
  id: string;
  title: string;
  content: string;
  variables: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  workspaceId: string;
  isTemplate: boolean;
  tags: string[];
  metadata: Record<string, any>;
}

/**
 * Interface for prompt version data
 */
interface IPromptVersion {
  id: string;
  promptId: string;
  content: string;
  changes: Record<string, any>;
  createdAt: Date;
  createdBy: string;
}

/**
 * Interface for prompt template data
 */
interface IPromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  variables: Record<string, any>;
  metadata: Record<string, any>;
}

/**
 * Decorator for tracking analytics
 */
function trackAnalytics(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const startTime = Date.now();
    try {
      const result = await originalMethod.apply(this, args);
      this.analyticsTracker.trackMetric({
        type: MetricType.PROMPT_OPERATIONS,
        value: 1,
        metadata: {
          operation: propertyKey,
          duration: Date.now() - startTime,
          success: true
        }
      });
      return result;
    } catch (error) {
      this.analyticsTracker.trackMetric({
        type: MetricType.PROMPT_OPERATIONS,
        value: 0,
        metadata: {
          operation: propertyKey,
          duration: Date.now() - startTime,
          success: false,
          error: error.message
        }
      });
      throw error;
    }
  };
  return descriptor;
}

/**
 * Service class implementing prompt management operations
 */
class PromptService {
  private cache: any;
  private retryConfig: any;

  constructor(
    private errorHandler: ErrorHandler,
    private analyticsTracker: AnalyticsTracker
  ) {
    this.initializeCache();
    this.configureRetry();
  }

  /**
   * Initializes caching mechanism
   */
  private async initializeCache(): Promise<void> {
    this.cache = await cacheManager.caching({
      store: 'memory',
      max: CACHE_MAX_ITEMS,
      ttl: CACHE_TTL
    });
  }

  /**
   * Configures retry logic for failed requests
   */
  private configureRetry(): void {
    this.retryConfig = {
      retries: 3,
      retryDelay: retry.exponentialDelay,
      retryCondition: (error: any) => {
        return retry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429;
      }
    };
  }

  /**
   * Retrieves all prompts with caching
   */
  @trackAnalytics
  async getAllPrompts(): Promise<IPrompt[]> {
    const cacheKey = 'all_prompts';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiService.get(API_ENDPOINTS.PROMPTS.BASE);
      await this.cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Retrieves a specific prompt by ID
   */
  @trackAnalytics
  async getPromptById(id: string): Promise<IPrompt> {
    const cacheKey = `prompt_${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiService.get(
        API_ENDPOINTS.PROMPTS.BY_ID.replace(':id', id)
      );
      await this.cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Creates a new prompt
   */
  @trackAnalytics
  async createPrompt(prompt: Omit<IPrompt, 'id'>): Promise<IPrompt> {
    try {
      const response = await apiService.post(API_ENDPOINTS.PROMPTS.BASE, prompt);
      await this.invalidatePromptsCache();
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Updates an existing prompt
   */
  @trackAnalytics
  async updatePrompt(id: string, prompt: Partial<IPrompt>): Promise<IPrompt> {
    try {
      const response = await apiService.put(
        API_ENDPOINTS.PROMPTS.BY_ID.replace(':id', id),
        prompt
      );
      await this.invalidatePromptsCache();
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Deletes a prompt
   */
  @trackAnalytics
  async deletePrompt(id: string): Promise<void> {
    try {
      await apiService.delete(API_ENDPOINTS.PROMPTS.BY_ID.replace(':id', id));
      await this.invalidatePromptsCache();
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Tests a prompt with provided variables
   */
  @trackAnalytics
  async testPrompt(id: string, variables: Record<string, any>): Promise<any> {
    try {
      const response = await apiService.post(
        API_ENDPOINTS.PROMPTS.TEST.replace(':id', id),
        { variables }
      );
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Optimizes a prompt using AI
   */
  @trackAnalytics
  async optimizePrompt(id: string): Promise<IPrompt> {
    try {
      const response = await apiService.post(
        API_ENDPOINTS.PROMPTS.OPTIMIZE.replace(':id', id)
      );
      await this.invalidatePromptsCache();
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Retrieves version history for a prompt
   */
  @trackAnalytics
  async getPromptVersions(id: string): Promise<IPromptVersion[]> {
    const cacheKey = `versions_${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiService.get(
        API_ENDPOINTS.PROMPTS.VERSIONS.replace(':id', id)
      );
      await this.cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Retrieves available prompt templates
   */
  @trackAnalytics
  async getPromptTemplates(): Promise<IPromptTemplate[]> {
    const cacheKey = 'templates';
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await apiService.get(API_ENDPOINTS.TEMPLATES.BASE);
      await this.cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.errorHandler.handleApiError(error);
    }
  }

  /**
   * Invalidates prompts-related cache
   */
  private async invalidatePromptsCache(): Promise<void> {
    await this.cache.del('all_prompts');
    const keys = await this.cache.keys();
    const promptKeys = keys.filter((key: string) => 
      key.startsWith('prompt_') || key.startsWith('versions_')
    );
    await Promise.all(promptKeys.map((key: string) => this.cache.del(key)));
  }
}

// Export singleton instance
export const promptService = new PromptService(new ErrorHandler(), new AnalyticsTracker());