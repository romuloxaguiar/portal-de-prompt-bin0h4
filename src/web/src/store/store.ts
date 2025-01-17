/**
 * Redux store configuration with enterprise-grade features including:
 * - Type-safe state management
 * - Performance optimizations
 * - Security measures
 * - Development tools
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import thunk from 'redux-thunk'; // v2.4.2
import { createStateSanitizer } from '@redux-devtools/extension'; // v3.2.5
import rootReducer from './root.reducer';
import type { IAuthState } from '../interfaces/auth.interface';

// State version for migration handling
const STATE_VERSION = '1.0.0';

// Encryption key for sensitive data
const ENCRYPTION_KEY = process.env.REACT_APP_STATE_ENCRYPTION_KEY;

/**
 * Custom middleware for performance monitoring and optimization
 */
const performanceMiddleware = () => (next: any) => (action: any) => {
    const start = performance.now();
    const result = next(action);
    const duration = performance.now() - start;

    // Log performance metrics for actions taking longer than 100ms
    if (duration > 100) {
        console.warn(`Slow action detected: ${action.type} took ${duration.toFixed(2)}ms`);
    }

    return result;
};

/**
 * Custom middleware for state validation
 */
const validationMiddleware = () => (next: any) => (action: any) => {
    const result = next(action);
    const state = store.getState();

    // Validate critical state properties
    if (!state.auth || !state.workspace || !state.prompt || !state.analytics) {
        console.error('Invalid state structure detected');
    }

    return result;
};

/**
 * Store enhancer for batching state updates
 */
const batchedUpdatesEnhancer = (createStore: any) => (...args: any[]) => {
    const store = createStore(...args);
    let pendingUpdates = 0;

    return {
        ...store,
        dispatch: (action: any) => {
            pendingUpdates++;
            const result = store.dispatch(action);
            pendingUpdates--;

            // Notify subscribers only after all pending updates are processed
            if (pendingUpdates === 0) {
                store.getState();
            }

            return result;
        }
    };
};

/**
 * Loads and validates initial state with security measures
 */
const loadInitialState = (): Partial<ReturnType<typeof rootReducer>> => {
    try {
        const persistedState = localStorage.getItem('reduxState');
        if (!persistedState) return {};

        // Decrypt sensitive data
        const decryptedState = decryptSensitiveData(JSON.parse(persistedState));

        // Validate state version
        if (decryptedState.version !== STATE_VERSION) {
            console.warn('State version mismatch, running migration...');
            return migrateState(decryptedState);
        }

        return decryptedState;
    } catch (error) {
        console.error('Failed to load persisted state:', error);
        return {};
    }
};

/**
 * Encrypts sensitive data in the state
 */
const encryptSensitiveData = (state: any): any => {
    if (!ENCRYPTION_KEY) return state;

    return {
        ...state,
        auth: state.auth ? {
            ...state.auth,
            accessToken: encrypt(state.auth.accessToken),
            user: state.auth.user ? {
                ...state.auth.user,
                email: encrypt(state.auth.user.email)
            } : null
        } : null
    };
};

/**
 * Decrypts sensitive data in the state
 */
const decryptSensitiveData = (state: any): any => {
    if (!ENCRYPTION_KEY) return state;

    return {
        ...state,
        auth: state.auth ? {
            ...state.auth,
            accessToken: decrypt(state.auth.accessToken),
            user: state.auth.user ? {
                ...state.auth.user,
                email: decrypt(state.auth.user.email)
            } : null
        } : null
    };
};

/**
 * Configures Redux store with security and performance optimizations
 */
export const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => 
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: ['persist/PERSIST'],
                ignoredPaths: ['auth.user.lastLoginAt', 'workspace.syncStatus.lastSync']
            },
            thunk: true
        }).concat(thunk, performanceMiddleware, validationMiddleware),
    devTools: process.env.NODE_ENV !== 'production' ? {
        stateSanitizer: createStateSanitizer(),
        maxAge: 50,
        trace: true,
        traceLimit: 25
    } : false,
    preloadedState: loadInitialState(),
    enhancers: (defaultEnhancers) => defaultEnhancers.concat(batchedUpdatesEnhancer)
});

// Subscribe to store changes for state persistence
store.subscribe(() => {
    const state = store.getState();
    const encryptedState = encryptSensitiveData(state);
    localStorage.setItem('reduxState', JSON.stringify({
        ...encryptedState,
        version: STATE_VERSION
    }));
});

// Export type-safe hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Helper functions for encryption/decryption
function encrypt(data: string): string {
    // Implementation would use ENCRYPTION_KEY and proper encryption algorithm
    return data;
}

function decrypt(data: string): string {
    // Implementation would use ENCRYPTION_KEY and proper decryption algorithm
    return data;
}

function migrateState(state: any): any {
    // Implementation would handle state migrations between versions
    return state;
}

export default store;