/**
 * Custom React hook for comprehensive prompt management with enhanced error handling,
 * analytics tracking, and caching capabilities.
 * @version 1.0.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'lodash'; // v4.17.21
import * as Sentry from '@sentry/react'; // v7.0.0
import { analyticsService } from '../services/analytics.service';
import { storage, StorageKeys } from '../utils/storage.util';
import { createError, handleError } from '../utils/error.util';
import { ErrorCode } from '../constants/error.constant';
import { MetricType } from '../interfaces/analytics.interface';

// Constants for performance optimization
const DEBOUNCE_DELAY = 500;
const CACHE_DURATION = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Interface for prompt data structure
 */
interface IPrompt {
  id: string;
  title: string;
  content: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  tags: string[];
  metadata: Record<string, any>;
}

/**
 * Interface for hook options
 */
interface IPromptHookOptions {
  enableCache?: boolean;
  retryOnError?: boolean;
  analyticsEnabled?: boolean;
  autoSave?: boolean;
}

/**
 * Interface for hook return value
 */
interface IUsePromptReturn {
  prompts: IPrompt[];
  selectedPrompt: IPrompt | null;
  loading: boolean;
  error: Error | null;
  createPrompt: (prompt: Partial<IPrompt>) => Promise<void>;
  updatePrompt: (id: string, updates: Partial<IPrompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  selectPrompt: (id: string) => void;
  retryOperation: (operation: () => Promise<void>) => Promise<void>;
  clearError: () => void;
  analytics: {
    usage: number;
    successRate: number;
    performance: Record<string, number>;
  };
}

/**
 * Enhanced custom hook for managing prompts with comprehensive error handling,
 * analytics tracking, and caching capabilities
 */
export const usePrompt = (
  workspaceId: string,
  options: IPromptHookOptions = {}
): IUsePromptReturn => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState({
    usage: 0,
    successRate: 0,
    performance: {}
  });

  // Redux selectors with error boundary
  const prompts = useSelector((state: any) => {
    try {
      return state.prompts.items.filter(
        (prompt: IPrompt) => prompt.workspaceId === workspaceId
      );
    } catch (error) {
      Sentry.captureException(error);
      return [];
    }
  });

  const selectedPrompt = useMemo(() => 
    prompts.find((prompt: IPrompt) => prompt.id === selectedPromptId) || null,
    [prompts, selectedPromptId]
  );

  /**
   * Cache management for prompt data
   */
  const cacheManager = useMemo(() => ({
    async get(key: string): Promise<any> {
      if (!options.enableCache) return null;
      return storage.getItem(`prompt_${key}`, { ttl: CACHE_DURATION });
    },
    async set(key: string, data: any): Promise<void> {
      if (!options.enableCache) return;
      await storage.setItem(`prompt_${key}`, data, {
        ttl: CACHE_DURATION,
        encrypt: true
      });
    },
    async invalidate(key: string): Promise<void> {
      await storage.removeItem(`prompt_${key}`);
    }
  }), [options.enableCache]);

  /**
   * Analytics tracking setup
   */
  const trackAnalytics = useCallback(async (
    action: string,
    promptId: string,
    metadata?: Record<string, any>
  ) => {
    if (!options.analyticsEnabled) return;

    try {
      await analyticsService.trackMetric({
        type: MetricType.USAGE,
        promptId,
        workspaceId,
        value: 1,
        metadata: {
          action,
          ...metadata
        }
      });
    } catch (error) {
      Sentry.captureException(error);
    }
  }, [workspaceId, options.analyticsEnabled]);

  /**
   * Error handling with retry capability
   */
  const retryOperation = async (operation: () => Promise<void>): Promise<void> => {
    let attempts = 0;
    while (attempts < MAX_RETRY_ATTEMPTS) {
      try {
        await operation();
        return;
      } catch (error) {
        attempts++;
        if (attempts === MAX_RETRY_ATTEMPTS) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  };

  /**
   * Create new prompt with error handling and analytics
   */
  const createPrompt = async (promptData: Partial<IPrompt>): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const newPrompt = {
        ...promptData,
        workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      await dispatch({ type: 'prompts/create', payload: newPrompt });
      await trackAnalytics('create', newPrompt.id as string);
      await cacheManager.invalidate('list');
    } catch (error) {
      const appError = handleError(error);
      setError(appError);
      Sentry.captureException(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update prompt with debouncing and auto-save
   */
  const updatePrompt = useMemo(() => 
    debounce(async (id: string, updates: Partial<IPrompt>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const updatedPrompt = {
          ...updates,
          updatedAt: new Date(),
          version: (selectedPrompt?.version || 0) + 1
        };

        await dispatch({ type: 'prompts/update', payload: { id, updates: updatedPrompt } });
        await trackAnalytics('update', id);
        await cacheManager.invalidate(id);
      } catch (error) {
        const appError = handleError(error);
        setError(appError);
        Sentry.captureException(error);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_DELAY),
    [selectedPrompt, dispatch, trackAnalytics, cacheManager]
  );

  /**
   * Delete prompt with confirmation and cleanup
   */
  const deletePrompt = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await dispatch({ type: 'prompts/delete', payload: id });
      await trackAnalytics('delete', id);
      await cacheManager.invalidate(id);
      await cacheManager.invalidate('list');
      
      if (selectedPromptId === id) {
        setSelectedPromptId(null);
      }
    } catch (error) {
      const appError = handleError(error);
      setError(appError);
      Sentry.captureException(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Select prompt with caching
   */
  const selectPrompt = async (id: string): Promise<void> => {
    try {
      const cachedPrompt = await cacheManager.get(id);
      if (cachedPrompt) {
        setSelectedPromptId(id);
        return;
      }

      setSelectedPromptId(id);
      await trackAnalytics('select', id);
      await cacheManager.set(id, prompts.find(p => p.id === id));
    } catch (error) {
      Sentry.captureException(error);
    }
  };

  /**
   * Clear current error state
   */
  const clearError = (): void => {
    setError(null);
  };

  /**
   * Initialize analytics and cache on mount
   */
  useEffect(() => {
    const initialize = async (): Promise<void> => {
      try {
        if (options.enableCache) {
          await storage.initializeStorage();
        }
        
        if (options.analyticsEnabled) {
          const metrics = await analyticsService.getMetrics({
            workspaceId,
            type: MetricType.USAGE
          });
          setAnalytics(prev => ({
            ...prev,
            usage: metrics.totalUsage,
            successRate: metrics.averageSuccessRate
          }));
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    };

    initialize();
  }, [workspaceId, options.enableCache, options.analyticsEnabled]);

  return {
    prompts,
    selectedPrompt,
    loading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
    selectPrompt,
    retryOperation,
    clearError,
    analytics
  };
};