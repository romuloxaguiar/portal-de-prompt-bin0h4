/**
 * @fileoverview Redux selectors for accessing and deriving prompt-related state
 * Implements memoized selectors with TypeScript type safety for optimal performance
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.0
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../root.reducer';
import { IPromptState } from './prompt.types';

/**
 * Base selector to access the prompt state slice
 * Provides type-safe access to the complete prompt state
 */
export const selectPromptState = (state: RootState): IPromptState => state.prompt;

/**
 * Memoized selector to get all prompts
 * Recomputes only when the prompts array reference changes
 */
export const selectAllPrompts = createSelector(
    [selectPromptState],
    (promptState): IPromptState['prompts'] => promptState.prompts
);

/**
 * Memoized selector to get the currently selected prompt
 * Returns null if no prompt is selected
 */
export const selectSelectedPrompt = createSelector(
    [selectPromptState],
    (promptState): IPromptState['selectedPrompt'] => promptState.selectedPrompt
);

/**
 * Memoized selector to get all prompt templates
 * Used for template-based prompt creation
 */
export const selectAllTemplates = createSelector(
    [selectPromptState],
    (promptState): IPromptState['templates'] => promptState.templates
);

/**
 * Memoized selector to get all versions of prompts
 * Used for version history tracking
 */
export const selectAllVersions = createSelector(
    [selectPromptState],
    (promptState): IPromptState['versions'] => promptState.versions
);

/**
 * Memoized selector to get the current optimization status
 * Used for tracking AI-powered optimization progress
 */
export const selectOptimizationStatus = createSelector(
    [selectPromptState],
    (promptState): IPromptState['optimizationStatus'] => promptState.optimizationStatus
);

/**
 * Memoized selector to get the loading state
 * Used for managing loading indicators and UI states
 */
export const selectPromptLoading = createSelector(
    [selectPromptState],
    (promptState): boolean => promptState.loading
);

/**
 * Memoized selector to get any error state
 * Used for error handling and user feedback
 */
export const selectPromptError = createSelector(
    [selectPromptState],
    (promptState): IPromptState['error'] => promptState.error
);

/**
 * Memoized selector to get versions for a specific prompt
 * @param promptId - ID of the prompt to get versions for
 */
export const selectPromptVersions = createSelector(
    [selectAllVersions, (_state: RootState, promptId: string) => promptId],
    (versions, promptId) => versions.filter(version => version.promptId === promptId)
);

/**
 * Memoized selector to check if a prompt is based on a template
 * @param promptId - ID of the prompt to check
 */
export const selectIsPromptTemplate = createSelector(
    [selectAllPrompts, (_state: RootState, promptId: string) => promptId],
    (prompts, promptId) => {
        const prompt = prompts.find(p => p.id === promptId);
        return prompt?.templateId !== null;
    }
);

/**
 * Memoized selector to get active prompts (non-archived)
 * Filters out archived or deprecated prompts
 */
export const selectActivePrompts = createSelector(
    [selectAllPrompts],
    (prompts) => prompts.filter(prompt => 
        prompt.status !== 'ARCHIVED' && prompt.status !== 'DEPRECATED'
    )
);

/**
 * Memoized selector to get prompts by team
 * @param teamId - ID of the team to filter prompts for
 */
export const selectPromptsByTeam = createSelector(
    [selectAllPrompts, (_state: RootState, teamId: string) => teamId],
    (prompts, teamId) => prompts.filter(prompt => prompt.teamId === teamId)
);