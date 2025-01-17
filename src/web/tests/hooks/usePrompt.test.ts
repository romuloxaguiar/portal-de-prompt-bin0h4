import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { analyticsService } from '../../src/services/analytics.service';
import { usePrompt } from '../../src/hooks/usePrompt';
import { IPrompt, PromptStatus } from '../../src/interfaces/prompt.interface';
import { ErrorCode } from '../../src/constants/error.constant';
import { storage } from '../../src/utils/storage.util';

// Mock fetch globally
import 'jest-fetch-mock';

// Mock dependencies
jest.mock('../../src/services/analytics.service');
jest.mock('../../src/utils/storage.util');

// Test data constants
const TEST_WORKSPACE_ID = 'test-workspace-123';
const TEST_PROMPT: IPrompt = {
  id: 'test-prompt-123',
  title: 'Test Prompt',
  content: 'Test content',
  templateId: null,
  variables: [],
  creatorId: 'test-user-123',
  teamId: 'test-team-123',
  currentVersion: {
    id: 'v1',
    content: 'Test content',
    changes: {
      description: 'Initial version',
      author: 'test-user-123',
      timestamp: new Date()
    }
  },
  status: PromptStatus.ACTIVE,
  metadata: {
    usageCount: 0,
    successRate: 0,
    lastUsed: new Date(),
    aiModel: 'gpt-4',
    averageResponseTime: 0,
    totalTokens: 0,
    costEstimate: 0
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock Redux store setup
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      prompts: (state = initialState, action) => {
        switch (action.type) {
          case 'prompts/create':
            return {
              ...state,
              items: [...state.items, action.payload]
            };
          case 'prompts/update':
            return {
              ...state,
              items: state.items.map((prompt: IPrompt) =>
                prompt.id === action.payload.id
                  ? { ...prompt, ...action.payload.updates }
                  : prompt
              )
            };
          case 'prompts/delete':
            return {
              ...state,
              items: state.items.filter((prompt: IPrompt) => prompt.id !== action.payload)
            };
          default:
            return state;
        }
      }
    },
    preloadedState: {
      prompts: {
        items: [TEST_PROMPT]
      }
    }
  });
};

describe('usePrompt Hook', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    jest.clearAllMocks();
    (analyticsService.trackMetric as jest.Mock).mockResolvedValue(undefined);
    (storage.initializeStorage as jest.Mock).mockResolvedValue(undefined);
  });

  const renderHookWithProvider = (workspaceId: string, options = {}) => {
    return renderHook(
      () => usePrompt(workspaceId, options),
      {
        wrapper: ({ children }) => (
          <Provider store={mockStore}>{children}</Provider>
        )
      }
    );
  };

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID);

      expect(result.current.prompts).toEqual([TEST_PROMPT]);
      expect(result.current.selectedPrompt).toBeNull();
      expect(result.current.loading).toBeFalsy();
      expect(result.current.error).toBeNull();
    });

    it('should initialize storage when cache is enabled', async () => {
      await act(async () => {
        renderHookWithProvider(TEST_WORKSPACE_ID, { enableCache: true });
      });

      expect(storage.initializeStorage).toHaveBeenCalled();
    });

    it('should initialize analytics when enabled', async () => {
      await act(async () => {
        renderHookWithProvider(TEST_WORKSPACE_ID, { analyticsEnabled: true });
      });

      expect(analyticsService.getMetrics).toHaveBeenCalledWith({
        workspaceId: TEST_WORKSPACE_ID,
        type: 'usage'
      });
    });
  });

  describe('Prompt Operations', () => {
    it('should create a new prompt with analytics tracking', async () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID, { analyticsEnabled: true });

      const newPrompt = {
        title: 'New Prompt',
        content: 'New content'
      };

      await act(async () => {
        await result.current.createPrompt(newPrompt);
      });

      expect(result.current.loading).toBeFalsy();
      expect(analyticsService.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'usage',
          promptId: expect.any(String)
        })
      );
    });

    it('should update prompt with debouncing', async () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID);

      await act(async () => {
        await result.current.updatePrompt(TEST_PROMPT.id, {
          content: 'Updated content'
        });
      });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));

      const updatedPrompt = result.current.prompts.find(p => p.id === TEST_PROMPT.id);
      expect(updatedPrompt?.content).toBe('Updated content');
    });

    it('should delete prompt and clean up references', async () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID);

      await act(async () => {
        await result.current.selectPrompt(TEST_PROMPT.id);
        await result.current.deletePrompt(TEST_PROMPT.id);
      });

      expect(result.current.selectedPrompt).toBeNull();
      expect(result.current.prompts).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry', async () => {
      const networkError = new Error('Network error');
      (analyticsService.trackMetric as jest.Mock).mockRejectedValueOnce(networkError);

      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID);

      await act(async () => {
        await result.current.retryOperation(async () => {
          await result.current.createPrompt({ title: 'Test' });
        });
      });

      expect(analyticsService.trackMetric).toHaveBeenCalledTimes(2);
    });

    it('should handle validation errors', async () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID);

      await act(async () => {
        await result.current.createPrompt({});
      });

      expect(result.current.error?.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('should clear errors', () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Analytics Integration', () => {
    it('should track prompt usage metrics', async () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID, { analyticsEnabled: true });

      await act(async () => {
        await result.current.selectPrompt(TEST_PROMPT.id);
      });

      expect(analyticsService.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'usage',
          promptId: TEST_PROMPT.id
        })
      );
    });

    it('should track performance metrics', async () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID, { analyticsEnabled: true });

      const startTime = Date.now();
      await act(async () => {
        await result.current.createPrompt({ title: 'Performance Test' });
      });

      expect(analyticsService.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'performance',
          value: expect.any(Number),
          metadata: expect.objectContaining({
            duration: expect.any(Number)
          })
        })
      );
    });
  });

  describe('Cache Management', () => {
    it('should use cached data when available', async () => {
      (storage.getItem as jest.Mock).mockResolvedValueOnce(TEST_PROMPT);

      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID, { enableCache: true });

      await act(async () => {
        await result.current.selectPrompt(TEST_PROMPT.id);
      });

      expect(storage.getItem).toHaveBeenCalledWith(
        expect.stringContaining(TEST_PROMPT.id)
      );
    });

    it('should invalidate cache on prompt update', async () => {
      const { result } = renderHookWithProvider(TEST_WORKSPACE_ID, { enableCache: true });

      await act(async () => {
        await result.current.updatePrompt(TEST_PROMPT.id, {
          content: 'Cache test'
        });
      });

      expect(storage.removeItem).toHaveBeenCalledWith(
        expect.stringContaining(TEST_PROMPT.id)
      );
    });
  });
});