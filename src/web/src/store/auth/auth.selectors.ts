/**
 * Redux selectors for authentication state management
 * Implements secure, memoized selectors for accessing authentication data
 * with strict type safety and proper null checking
 * @version 1.0.0
 * @package @reduxjs/toolkit ^1.9.5
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../root.reducer';
import type { IAuthState } from '../../interfaces/auth.interface';

/**
 * Base selector for accessing the auth slice of the Redux store
 * Provides type-safe access to authentication state
 */
export const selectAuthState = (state: RootState): IAuthState => state.auth;

/**
 * Memoized selector for checking authentication status
 * Returns boolean indicating if user is currently authenticated
 */
export const selectIsAuthenticated = createSelector(
    [selectAuthState],
    (authState): boolean => authState.isAuthenticated
);

/**
 * Memoized selector for accessing current authenticated user data
 * Returns null if no user is authenticated, implementing proper null safety
 */
export const selectCurrentUser = createSelector(
    [selectAuthState],
    (authState) => authState.user
);

/**
 * Memoized selector for accessing the current OAuth access token
 * Returns null if no valid token exists, implementing proper null safety
 */
export const selectAccessToken = createSelector(
    [selectAuthState],
    (authState) => authState.accessToken
);

/**
 * Memoized selector for checking if MFA is required
 * Returns boolean indicating if multi-factor authentication is needed
 */
export const selectMfaRequired = createSelector(
    [selectAuthState],
    (authState) => authState.mfaRequired
);

/**
 * Memoized selector for checking MFA verification status
 * Returns boolean indicating if MFA has been verified
 */
export const selectMfaVerified = createSelector(
    [selectAuthState],
    (authState) => authState.mfaVerified
);

/**
 * Memoized selector for accessing authentication loading state
 * Returns boolean indicating if any auth operation is in progress
 */
export const selectAuthLoading = createSelector(
    [selectAuthState],
    (authState) => authState.loading
);

/**
 * Memoized selector for accessing authentication error state
 * Returns error object if present, null otherwise
 */
export const selectAuthError = createSelector(
    [selectAuthState],
    (authState) => authState.error
);