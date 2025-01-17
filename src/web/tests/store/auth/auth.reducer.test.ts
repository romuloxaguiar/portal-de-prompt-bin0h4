/**
 * Test suite for authentication reducer
 * Validates OAuth 2.0 flow, MFA, and security state management
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from '@jest/globals'; // v29.5.0
import authReducer from '../../../src/store/auth/auth.reducer';
import { AuthActionTypes } from '../../../src/store/auth/auth.types';
import { AuthProvider, MFAMethod } from '../../../src/interfaces/auth.interface';
import type { IAuthState, IAuthUser, IAuthTokens, IAuthError } from '../../../src/interfaces/auth.interface';

describe('Auth Reducer', () => {
    // Mock test data
    const mockUser: IAuthUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        provider: AuthProvider.GOOGLE,
        avatarUrl: 'https://example.com/avatar.jpg',
        providerMetadata: {}
    };

    const mockTokens: IAuthTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: 'read write'
    };

    const mockError: IAuthError = {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        details: {}
    };

    let initialState: IAuthState;

    beforeEach(() => {
        initialState = {
            isAuthenticated: false,
            user: null,
            accessToken: null,
            loading: false,
            error: null,
            mfaRequired: false,
            mfaVerified: false
        };
    });

    it('should return initial state', () => {
        const state = authReducer(undefined, { type: '@@INIT' });
        expect(state).toEqual(initialState);
    });

    it('should handle LOGIN_REQUEST', () => {
        const state = authReducer(initialState, {
            type: AuthActionTypes.LOGIN_REQUEST
        });

        expect(state).toEqual({
            ...initialState,
            loading: true,
            error: null
        });
    });

    it('should handle LOGIN_SUCCESS without MFA', () => {
        const state = authReducer(initialState, {
            type: AuthActionTypes.LOGIN_SUCCESS,
            payload: {
                user: mockUser,
                tokens: mockTokens,
                mfaRequired: false
            }
        });

        expect(state).toEqual({
            ...initialState,
            isAuthenticated: true,
            user: mockUser,
            accessToken: mockTokens.accessToken,
            mfaRequired: false,
            mfaVerified: true
        });
    });

    it('should handle LOGIN_SUCCESS with MFA required', () => {
        const state = authReducer(initialState, {
            type: AuthActionTypes.LOGIN_SUCCESS,
            payload: {
                user: mockUser,
                tokens: mockTokens,
                mfaRequired: true
            }
        });

        expect(state).toEqual({
            ...initialState,
            isAuthenticated: true,
            user: mockUser,
            accessToken: mockTokens.accessToken,
            mfaRequired: true,
            mfaVerified: false
        });
    });

    it('should handle LOGIN_FAILURE', () => {
        const state = authReducer(initialState, {
            type: AuthActionTypes.LOGIN_FAILURE,
            payload: {
                error: 'Invalid credentials',
                errorCode: 'AUTH_INVALID_CREDENTIALS'
            }
        });

        expect(state).toEqual({
            ...initialState,
            error: {
                code: 'AUTH_INVALID_CREDENTIALS',
                message: 'Invalid credentials',
                details: {}
            }
        });
    });

    it('should handle LOGOUT', () => {
        const loggedInState: IAuthState = {
            ...initialState,
            isAuthenticated: true,
            user: mockUser,
            accessToken: mockTokens.accessToken
        };

        const state = authReducer(loggedInState, {
            type: AuthActionTypes.LOGOUT
        });

        expect(state).toEqual(initialState);
    });

    it('should handle REFRESH_TOKEN', () => {
        const newToken = 'new-access-token';
        const state = authReducer(initialState, {
            type: AuthActionTypes.REFRESH_TOKEN,
            payload: {
                ...mockTokens,
                accessToken: newToken
            }
        });

        expect(state).toEqual({
            ...initialState,
            accessToken: newToken,
            error: null
        });
    });

    it('should handle MFA_REQUIRED', () => {
        const state = authReducer(initialState, {
            type: AuthActionTypes.MFA_REQUIRED,
            payload: {
                mfaType: MFAMethod.TOTP,
                mfaToken: 'mfa-session-token'
            }
        });

        expect(state).toEqual({
            ...initialState,
            mfaRequired: true,
            mfaVerified: false,
            loading: false
        });
    });

    it('should handle MFA_VERIFY', () => {
        const mfaState: IAuthState = {
            ...initialState,
            mfaRequired: true,
            user: mockUser
        };

        const state = authReducer(mfaState, {
            type: AuthActionTypes.MFA_VERIFY,
            payload: {
                verificationCode: '123456',
                mfaToken: 'mfa-session-token'
            }
        });

        expect(state).toEqual({
            ...mfaState,
            mfaVerified: true,
            loading: false,
            error: null
        });
    });

    it('should handle SESSION_EXPIRED', () => {
        const authenticatedState: IAuthState = {
            ...initialState,
            isAuthenticated: true,
            user: mockUser,
            accessToken: mockTokens.accessToken
        };

        const state = authReducer(authenticatedState, {
            type: AuthActionTypes.SESSION_EXPIRED
        });

        expect(state).toEqual({
            ...initialState,
            error: {
                code: 'SESSION_EXPIRED',
                message: 'Your session has expired. Please login again.',
                details: {}
            }
        });
    });

    it('should handle TOKEN_REFRESH_FAILURE', () => {
        const state = authReducer(initialState, {
            type: AuthActionTypes.TOKEN_REFRESH_FAILURE,
            payload: {
                error: 'Token refresh failed'
            }
        });

        expect(state).toEqual({
            ...initialState,
            error: {
                code: 'TOKEN_REFRESH_FAILED',
                message: 'Token refresh failed',
                details: {}
            }
        });
    });

    it('should maintain immutability', () => {
        const startState = { ...initialState };
        const nextState = authReducer(startState, {
            type: AuthActionTypes.LOGIN_REQUEST
        });

        expect(startState).not.toBe(nextState);
        expect(startState).toEqual(initialState);
    });

    it('should handle unknown action types', () => {
        const state = authReducer(initialState, {
            type: 'UNKNOWN_ACTION' as any
        });

        expect(state).toBe(initialState);
    });
});