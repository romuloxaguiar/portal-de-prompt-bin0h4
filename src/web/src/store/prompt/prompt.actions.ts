/**
 * Redux action creators for managing prompt-related state in the frontend application.
 * Implements comprehensive CRUD operations with error handling and analytics tracking.
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { PromptActionTypes } from './prompt.types';
import { ErrorHandler } from '../../utils/error.util';
import { analyticsService } from '../../services/analytics.service';
import { apiService } from '../../services/api.service';
import { API_ENDPOINTS } from '../../constants/api.constant';
import { storage, StorageKeys } from '../../utils/storage.util';
import { MetricType } from '../../interfaces/analytics.interface';
import { IPrompt, PromptStatus } from '../../interfaces/prompt.interface';
import { ErrorCode } from '../../constants/error.constant';

// Cache configuration
const CACHE_TTL = 300000; // 5 minutes
const CACHE_KEY = StorageKeys.CACHED_TEMPLATES;

/**
 * Sets loading state for prompt operations
 */
export const setLoading = (loading: boolean) => {
  analyticsService.trackMetric({
    type: MetricType.USAGE,
    value: loading ? 1 : 0,
    metadata: { action: 'loading_state_change' }
  });

  return {
    type: PromptActionTypes.SET_LOADING,
    payload: loading
  };
};

/**
 * Sets error state with enhanced error handling
 */
export const setError = (error: Error | null) => {
  if (error) {
    ErrorHandler.logError(error);
    analyticsService.trackMetric({
      type: MetricType.ERROR_RATE,
      value: 1,
      metadata: { error: error.message }
    });
  }

  return {
    type: PromptActionTypes.SET_ERROR,
    payload: error
  };
};

/**
 * Fetches all prompts with caching and error handling
 */
export const fetchPrompts = createAsyncThunk(
  PromptActionTypes.FETCH_PROMPTS,
  async (_, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));
      
      // Check cache first
      const cachedPrompts = await storage.getItem<IPrompt[]>(CACHE_KEY);
      if (cachedPrompts) {
        return cachedPrompts;
      }

      analyticsService.trackMetric({
        type: MetricType.USAGE,
        value: 1,
        metadata: { action: 'fetch_prompts' }
      });

      const response = await apiService.get<IPrompt[]>(API_ENDPOINTS.PROMPTS.BASE);
      const prompts = response.data;

      // Cache the results
      await storage.setItem(CACHE_KEY, prompts, {
        ttl: CACHE_TTL,
        encrypt: true
      });

      return prompts;
    } catch (error) {
      const handledError = ErrorHandler.handleError(error as Error);
      dispatch(setError(handledError));
      return rejectWithValue(handledError);
    } finally {
      dispatch(setLoading(false));
    }
  }
);

/**
 * Fetches a single prompt by ID
 */
export const fetchPrompt = createAsyncThunk(
  PromptActionTypes.FETCH_PROMPT,
  async (promptId: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));

      analyticsService.trackMetric({
        type: MetricType.USAGE,
        value: 1,
        metadata: { action: 'fetch_prompt', promptId }
      });

      const response = await apiService.get<IPrompt>(
        API_ENDPOINTS.PROMPTS.BY_ID.replace(':id', promptId)
      );

      return response.data;
    } catch (error) {
      const handledError = ErrorHandler.handleError(error as Error);
      dispatch(setError(handledError));
      return rejectWithValue(handledError);
    } finally {
      dispatch(setLoading(false));
    }
  }
);

/**
 * Creates a new prompt with analytics tracking
 */
export const createPrompt = createAsyncThunk(
  PromptActionTypes.CREATE_PROMPT,
  async (prompt: Omit<IPrompt, 'id'>, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));

      analyticsService.trackMetric({
        type: MetricType.USAGE,
        value: 1,
        metadata: { action: 'create_prompt' }
      });

      const response = await apiService.post<IPrompt>(
        API_ENDPOINTS.PROMPTS.BASE,
        prompt
      );

      // Invalidate cache
      await storage.removeItem(CACHE_KEY);

      analyticsService.trackMetric({
        type: MetricType.SUCCESS_RATE,
        value: 1,
        metadata: { action: 'prompt_created', promptId: response.data.id }
      });

      return response.data;
    } catch (error) {
      const handledError = ErrorHandler.handleError(error as Error);
      dispatch(setError(handledError));
      return rejectWithValue(handledError);
    } finally {
      dispatch(setLoading(false));
    }
  }
);

/**
 * Updates an existing prompt with optimistic updates
 */
export const updatePrompt = createAsyncThunk(
  PromptActionTypes.UPDATE_PROMPT,
  async (prompt: IPrompt, { dispatch, rejectWithValue, getState }) => {
    try {
      dispatch(setLoading(true));

      analyticsService.trackMetric({
        type: MetricType.USAGE,
        value: 1,
        metadata: { action: 'update_prompt', promptId: prompt.id }
      });

      const response = await apiService.put<IPrompt>(
        API_ENDPOINTS.PROMPTS.BY_ID.replace(':id', prompt.id),
        prompt
      );

      // Invalidate cache
      await storage.removeItem(CACHE_KEY);

      analyticsService.trackMetric({
        type: MetricType.SUCCESS_RATE,
        value: 1,
        metadata: { action: 'prompt_updated', promptId: prompt.id }
      });

      return response.data;
    } catch (error) {
      const handledError = ErrorHandler.handleError(error as Error);
      dispatch(setError(handledError));
      return rejectWithValue(handledError);
    } finally {
      dispatch(setLoading(false));
    }
  }
);

/**
 * Deletes a prompt with confirmation
 */
export const deletePrompt = createAsyncThunk(
  PromptActionTypes.DELETE_PROMPT,
  async (promptId: string, { dispatch, rejectWithValue }) => {
    try {
      dispatch(setLoading(true));

      analyticsService.trackMetric({
        type: MetricType.USAGE,
        value: 1,
        metadata: { action: 'delete_prompt', promptId }
      });

      await apiService.delete(
        API_ENDPOINTS.PROMPTS.BY_ID.replace(':id', promptId)
      );

      // Invalidate cache
      await storage.removeItem(CACHE_KEY);

      analyticsService.trackMetric({
        type: MetricType.SUCCESS_RATE,
        value: 1,
        metadata: { action: 'prompt_deleted', promptId }
      });

      return promptId;
    } catch (error) {
      const handledError = ErrorHandler.handleError(error as Error);
      dispatch(setError(handledError));
      return rejectWithValue(handledError);
    } finally {
      dispatch(setLoading(false));
    }
  }
);

// Export all actions
export const promptActions = {
  setLoading,
  setError,
  fetchPrompts,
  fetchPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt
};

export default promptActions;