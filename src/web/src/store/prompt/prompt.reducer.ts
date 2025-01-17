/**
 * @fileoverview Redux reducer for managing prompt-related state
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.0
 */

import { createReducer } from '@reduxjs/toolkit';
import { 
    IPromptState, 
    PromptActionTypes, 
    OptimizationStatus,
    IPromptError
} from './prompt.types';

/**
 * Initial state for the prompt reducer
 */
const initialState: IPromptState = {
    prompts: [],
    selectedPrompt: null,
    templates: [],
    versions: [],
    optimizationStatus: OptimizationStatus.IDLE,
    loading: false,
    error: null
};

/**
 * Redux reducer for handling all prompt-related state updates
 */
const promptReducer = createReducer(initialState, (builder) => {
    builder
        // Fetch all prompts
        .addCase(PromptActionTypes.FETCH_PROMPTS, (state, action) => {
            state.prompts = action.payload;
            state.error = null;
        })

        // Fetch single prompt
        .addCase(PromptActionTypes.FETCH_PROMPT, (state, action) => {
            state.selectedPrompt = action.payload;
            state.error = null;
        })

        // Create new prompt
        .addCase(PromptActionTypes.CREATE_PROMPT, (state, action) => {
            state.prompts.push(action.payload);
            state.selectedPrompt = action.payload;
            state.error = null;
        })

        // Update existing prompt
        .addCase(PromptActionTypes.UPDATE_PROMPT, (state, action) => {
            const index = state.prompts.findIndex(prompt => prompt.id === action.payload.id);
            if (index !== -1) {
                state.prompts[index] = action.payload;
                if (state.selectedPrompt?.id === action.payload.id) {
                    state.selectedPrompt = action.payload;
                }
            }
            state.error = null;
        })

        // Delete prompt
        .addCase(PromptActionTypes.DELETE_PROMPT, (state, action) => {
            state.prompts = state.prompts.filter(prompt => prompt.id !== action.payload);
            if (state.selectedPrompt?.id === action.payload) {
                state.selectedPrompt = null;
            }
            state.error = null;
        })

        // Handle AI optimization
        .addCase(PromptActionTypes.OPTIMIZE_PROMPT, (state, action) => {
            state.optimizationStatus = OptimizationStatus.OPTIMIZING;
            const index = state.prompts.findIndex(prompt => prompt.id === action.payload.promptId);
            if (index !== -1) {
                state.prompts[index] = {
                    ...state.prompts[index],
                    content: action.payload.optimizedContent,
                    metadata: {
                        ...state.prompts[index].metadata,
                        lastUsed: new Date(),
                    }
                };
                state.optimizationStatus = OptimizationStatus.COMPLETED;
            } else {
                state.optimizationStatus = OptimizationStatus.FAILED;
                state.error = {
                    code: 'OPTIMIZATION_ERROR',
                    message: 'Failed to optimize prompt: Prompt not found',
                    details: { promptId: action.payload.promptId }
                };
            }
        })

        // Create new version
        .addCase(PromptActionTypes.CREATE_VERSION, (state, action) => {
            state.versions.push({
                id: action.payload.id,
                promptId: action.payload.promptId,
                version: state.versions.length + 1,
                content: action.payload.content,
                createdAt: new Date()
            });
            state.error = null;
        })

        // Fetch versions
        .addCase(PromptActionTypes.FETCH_VERSIONS, (state, action) => {
            state.versions = action.payload;
            state.error = null;
        })

        // Create template
        .addCase(PromptActionTypes.CREATE_TEMPLATE, (state, action) => {
            state.templates.push(action.payload);
            state.error = null;
        })

        // Fetch templates
        .addCase(PromptActionTypes.FETCH_TEMPLATES, (state, action) => {
            state.templates = action.payload;
            state.error = null;
        })

        // Set loading state
        .addCase(PromptActionTypes.SET_LOADING, (state, action) => {
            state.loading = action.payload;
        })

        // Set error state
        .addCase(PromptActionTypes.SET_ERROR, (state, action) => {
            state.error = action.payload as IPromptError;
            if (action.payload) {
                state.optimizationStatus = OptimizationStatus.FAILED;
            }
        });
});

export default promptReducer;