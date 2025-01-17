/**
 * Root reducer configuration that combines all feature reducers for global state management
 * Implements centralized state management using Redux Toolkit for enterprise-scale applications
 * @version 1.0.0
 */

import { combineReducers } from '@reduxjs/toolkit'; // v1.9.5
import authReducer from './auth/auth.reducer';
import analyticsReducer from './analytics/analytics.reducer';
import promptReducer from './prompt/prompt.reducer';
import workspaceReducer from './workspace/workspace.reducer';

/**
 * Root state interface combining all feature states
 * Provides type safety for the global application state
 */
export interface RootState {
    auth: ReturnType<typeof authReducer>;
    analytics: ReturnType<typeof analyticsReducer>;
    prompt: ReturnType<typeof promptReducer>;
    workspace: ReturnType<typeof workspaceReducer>;
}

/**
 * Root reducer combining all feature reducers using Redux Toolkit's combineReducers
 * Ensures type safety and proper state composition for the global store
 * 
 * Feature reducers:
 * - auth: Handles authentication state, OAuth flow, and MFA
 * - analytics: Manages metrics, reporting, and real-time analytics
 * - prompt: Controls prompt templates, versions, and CRUD operations
 * - workspace: Manages team collaboration and real-time updates
 */
const rootReducer = combineReducers<RootState>({
    auth: authReducer,
    analytics: analyticsReducer,
    prompt: promptReducer,
    workspace: workspaceReducer
});

export default rootReducer;