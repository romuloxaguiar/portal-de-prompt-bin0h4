/**
 * Authentication reducer for managing secure auth state with OAuth 2.0 and MFA support
 * @version 1.0.0
 */

import { Reducer } from '@reduxjs/toolkit'; // v1.9.5
import { AuthActionTypes, AuthAction } from './auth.types';
import { IAuthState } from '../../interfaces/auth.interface';

/**
 * Initial authentication state with security defaults
 * All sensitive fields initialized as null for security
 */
export const initialState: IAuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    loading: false,
    error: null,
    mfaRequired: false,
    mfaVerified: false
};

/**
 * Authentication reducer handling secure state transitions
 * Implements immutable state updates and strict type checking
 */
const authReducer: Reducer<IAuthState, AuthAction> = (
    state = initialState,
    action
): IAuthState => {
    switch (action.type) {
        case AuthActionTypes.LOGIN_REQUEST:
            return {
                ...state,
                loading: true,
                error: null,
                isAuthenticated: false,
                mfaRequired: false,
                mfaVerified: false
            };

        case AuthActionTypes.LOGIN_SUCCESS:
            return {
                ...state,
                isAuthenticated: true,
                user: action.payload.user,
                accessToken: action.payload.tokens.accessToken,
                loading: false,
                error: null,
                mfaRequired: action.payload.mfaRequired,
                mfaVerified: !action.payload.mfaRequired
            };

        case AuthActionTypes.LOGIN_FAILURE:
            return {
                ...initialState,
                error: {
                    code: action.payload.errorCode || 'AUTH_ERROR',
                    message: action.payload.error,
                    details: {}
                }
            };

        case AuthActionTypes.LOGOUT:
            return {
                ...initialState
            };

        case AuthActionTypes.REFRESH_TOKEN:
            return {
                ...state,
                accessToken: action.payload.accessToken,
                error: null
            };

        case AuthActionTypes.MFA_REQUIRED:
            return {
                ...state,
                mfaRequired: true,
                mfaVerified: false,
                loading: false
            };

        case AuthActionTypes.MFA_VERIFY:
            return {
                ...state,
                mfaVerified: true,
                loading: false,
                error: null
            };

        case AuthActionTypes.SESSION_EXPIRED:
            return {
                ...initialState,
                error: {
                    code: 'SESSION_EXPIRED',
                    message: 'Your session has expired. Please login again.',
                    details: {}
                }
            };

        case AuthActionTypes.TOKEN_REFRESH_FAILURE:
            return {
                ...initialState,
                error: {
                    code: 'TOKEN_REFRESH_FAILED',
                    message: action.payload.error,
                    details: {}
                }
            };

        default:
            return state;
    }
};

export default authReducer;