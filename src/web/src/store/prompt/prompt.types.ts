/**
 * @fileoverview TypeScript types and enums for Redux state management of prompts
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.0
 */

import { PayloadAction } from '@reduxjs/toolkit';
import { IPrompt } from '../../interfaces/prompt.interface';

/**
 * Enum defining all possible prompt-related Redux action types
 */
export enum PromptActionTypes {
    FETCH_PROMPTS = 'prompt/fetchPrompts',
    FETCH_PROMPT = 'prompt/fetchPrompt',
    CREATE_PROMPT = 'prompt/createPrompt',
    UPDATE_PROMPT = 'prompt/updatePrompt',
    DELETE_PROMPT = 'prompt/deletePrompt',
    SET_LOADING = 'prompt/setLoading',
    SET_ERROR = 'prompt/setError',
    OPTIMIZE_PROMPT = 'prompt/optimizePrompt',
    CREATE_VERSION = 'prompt/createVersion',
    FETCH_VERSIONS = 'prompt/fetchVersions',
    CREATE_TEMPLATE = 'prompt/createTemplate',
    FETCH_TEMPLATES = 'prompt/fetchTemplates'
}

/**
 * Interface defining structured error information
 */
export interface IPromptError {
    code: string;
    message: string;
    details: any;
}

/**
 * Interface for prompt version information
 */
export interface IPromptVersion {
    id: string;
    promptId: string;
    version: number;
    content: string;
    createdAt: Date;
}

/**
 * Enum for AI optimization status
 */
export enum OptimizationStatus {
    IDLE = 'IDLE',
    OPTIMIZING = 'OPTIMIZING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}

/**
 * Interface defining the shape of prompt-related Redux state
 */
export interface IPromptState {
    prompts: IPrompt[];
    selectedPrompt: IPrompt | null;
    templates: IPrompt[];
    versions: IPromptVersion[];
    loading: boolean;
    error: IPromptError | null;
    optimizationStatus: OptimizationStatus;
}

/**
 * Type definition for action payloads based on action type
 */
export type PromptPayload = {
    FETCH_PROMPTS: void;
    FETCH_PROMPT: string;
    CREATE_PROMPT: Omit<IPrompt, 'id'>;
    UPDATE_PROMPT: IPrompt;
    DELETE_PROMPT: string;
    OPTIMIZE_PROMPT: string;
    CREATE_VERSION: { promptId: string; content: string };
    FETCH_VERSIONS: string;
    CREATE_TEMPLATE: Omit<IPrompt, 'id'>;
    FETCH_TEMPLATES: void;
}

/**
 * Type definition for prompt-related Redux actions
 */
export type PromptAction<T extends keyof PromptPayload> = {
    type: T;
    payload: PromptPayload[T];
} & PayloadAction<PromptPayload[T]>;