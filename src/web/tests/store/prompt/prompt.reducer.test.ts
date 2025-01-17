/**
 * @fileoverview Unit tests for prompt reducer
 * @version 1.0.0
 * @package jest ^29.0.0
 */

import { describe, test, expect } from '@jest/globals';
import promptReducer from '../../../src/store/prompt/prompt.reducer';
import { PromptActionTypes, IPromptState, OptimizationStatus } from '../../../src/store/prompt/prompt.types';

// Mock data for testing
const mockPrompt = {
  id: 'test-id',
  title: 'Test Prompt',
  content: 'Test content',
  templateId: 'template-id',
  variables: [],
  creatorId: 'creator-id',
  teamId: 'team-id',
  status: 'ACTIVE',
  metadata: {
    usageCount: 0,
    successRate: 0,
    lastUsed: null,
    aiModel: 'gpt-4',
    averageResponseTime: 0,
    optimizationHistory: []
  },
  versions: [],
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z'
};

const mockTemplate = {
  id: 'template-id',
  title: 'Test Template',
  content: 'Template content',
  variables: [],
  creatorId: 'creator-id',
  teamId: 'team-id',
  status: 'ACTIVE',
  metadata: {
    usageCount: 0,
    successRate: 0,
    lastUsed: null,
    aiModel: 'gpt-4',
    averageResponseTime: 0
  },
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z'
};

const mockVersion = {
  id: 'version-id',
  promptId: 'test-id',
  version: 1,
  content: 'Version content',
  createdAt: new Date('2023-01-01T00:00:00.000Z')
};

const initialState: IPromptState = {
  prompts: [],
  templates: [],
  versions: [],
  selectedPrompt: null,
  optimizationStatus: OptimizationStatus.IDLE,
  loading: false,
  error: null
};

describe('promptReducer', () => {
  test('should return initial state', () => {
    expect(promptReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('CRUD Operations', () => {
    test('should handle FETCH_PROMPTS', () => {
      const prompts = [mockPrompt];
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.FETCH_PROMPTS,
        payload: prompts
      });
      expect(newState.prompts).toEqual(prompts);
      expect(newState.error).toBeNull();
    });

    test('should handle FETCH_PROMPT', () => {
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.FETCH_PROMPT,
        payload: mockPrompt
      });
      expect(newState.selectedPrompt).toEqual(mockPrompt);
      expect(newState.error).toBeNull();
    });

    test('should handle CREATE_PROMPT', () => {
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.CREATE_PROMPT,
        payload: mockPrompt
      });
      expect(newState.prompts).toContainEqual(mockPrompt);
      expect(newState.selectedPrompt).toEqual(mockPrompt);
      expect(newState.error).toBeNull();
    });

    test('should handle UPDATE_PROMPT', () => {
      const initialStateWithPrompt = {
        ...initialState,
        prompts: [mockPrompt],
        selectedPrompt: mockPrompt
      };
      const updatedPrompt = { ...mockPrompt, title: 'Updated Title' };
      const newState = promptReducer(initialStateWithPrompt, {
        type: PromptActionTypes.UPDATE_PROMPT,
        payload: updatedPrompt
      });
      expect(newState.prompts[0].title).toBe('Updated Title');
      expect(newState.selectedPrompt?.title).toBe('Updated Title');
      expect(newState.error).toBeNull();
    });

    test('should handle DELETE_PROMPT', () => {
      const initialStateWithPrompt = {
        ...initialState,
        prompts: [mockPrompt],
        selectedPrompt: mockPrompt
      };
      const newState = promptReducer(initialStateWithPrompt, {
        type: PromptActionTypes.DELETE_PROMPT,
        payload: mockPrompt.id
      });
      expect(newState.prompts).toHaveLength(0);
      expect(newState.selectedPrompt).toBeNull();
      expect(newState.error).toBeNull();
    });
  });

  describe('Template Management', () => {
    test('should handle CREATE_TEMPLATE', () => {
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.CREATE_TEMPLATE,
        payload: mockTemplate
      });
      expect(newState.templates).toContainEqual(mockTemplate);
      expect(newState.error).toBeNull();
    });

    test('should handle FETCH_TEMPLATES', () => {
      const templates = [mockTemplate];
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.FETCH_TEMPLATES,
        payload: templates
      });
      expect(newState.templates).toEqual(templates);
      expect(newState.error).toBeNull();
    });
  });

  describe('Version Control', () => {
    test('should handle CREATE_VERSION', () => {
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.CREATE_VERSION,
        payload: {
          id: mockVersion.id,
          promptId: mockVersion.promptId,
          content: mockVersion.content
        }
      });
      expect(newState.versions).toHaveLength(1);
      expect(newState.versions[0].promptId).toBe(mockVersion.promptId);
      expect(newState.error).toBeNull();
    });

    test('should handle FETCH_VERSIONS', () => {
      const versions = [mockVersion];
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.FETCH_VERSIONS,
        payload: versions
      });
      expect(newState.versions).toEqual(versions);
      expect(newState.error).toBeNull();
    });
  });

  describe('Optimization Features', () => {
    test('should handle OPTIMIZE_PROMPT success', () => {
      const initialStateWithPrompt = {
        ...initialState,
        prompts: [mockPrompt]
      };
      const optimizedContent = 'Optimized content';
      const newState = promptReducer(initialStateWithPrompt, {
        type: PromptActionTypes.OPTIMIZE_PROMPT,
        payload: {
          promptId: mockPrompt.id,
          optimizedContent
        }
      });
      expect(newState.prompts[0].content).toBe(optimizedContent);
      expect(newState.optimizationStatus).toBe(OptimizationStatus.COMPLETED);
      expect(newState.error).toBeNull();
    });

    test('should handle OPTIMIZE_PROMPT failure', () => {
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.OPTIMIZE_PROMPT,
        payload: {
          promptId: 'non-existent-id',
          optimizedContent: 'Optimized content'
        }
      });
      expect(newState.optimizationStatus).toBe(OptimizationStatus.FAILED);
      expect(newState.error).toEqual({
        code: 'OPTIMIZATION_ERROR',
        message: 'Failed to optimize prompt: Prompt not found',
        details: { promptId: 'non-existent-id' }
      });
    });
  });

  describe('Loading and Error States', () => {
    test('should handle SET_LOADING', () => {
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.SET_LOADING,
        payload: true
      });
      expect(newState.loading).toBe(true);
    });

    test('should handle SET_ERROR', () => {
      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: { test: 'details' }
      };
      const newState = promptReducer(initialState, {
        type: PromptActionTypes.SET_ERROR,
        payload: error
      });
      expect(newState.error).toEqual(error);
      expect(newState.optimizationStatus).toBe(OptimizationStatus.FAILED);
    });

    test('should clear error when successful action occurs', () => {
      const stateWithError = {
        ...initialState,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          details: {}
        }
      };
      const newState = promptReducer(stateWithError, {
        type: PromptActionTypes.FETCH_PROMPTS,
        payload: []
      });
      expect(newState.error).toBeNull();
    });
  });
});