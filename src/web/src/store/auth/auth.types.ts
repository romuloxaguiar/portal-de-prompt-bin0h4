/**
 * Authentication action types and interfaces for Redux state management
 * Implements secure authentication flow with MFA support and strict type safety
 * @version 1.0.0
 */

import { Action } from 'redux'; // v4.2.1
import { IAuthUser, IAuthTokens } from '../../interfaces/auth.interface';

/**
 * Enum of authentication action type constants with enhanced security states
 */
export enum AuthActionTypes {
    LOGIN_REQUEST = 'auth/LOGIN_REQUEST',
    LOGIN_SUCCESS = 'auth/LOGIN_SUCCESS',
    LOGIN_FAILURE = 'auth/LOGIN_FAILURE',
    LOGOUT = 'auth/LOGOUT',
    REFRESH_TOKEN = 'auth/REFRESH_TOKEN',
    MFA_REQUIRED = 'auth/MFA_REQUIRED',
    MFA_VERIFY = 'auth/MFA_VERIFY',
    SESSION_EXPIRED = 'auth/SESSION_EXPIRED',
    TOKEN_REFRESH_FAILURE = 'auth/TOKEN_REFRESH_FAILURE'
}

/**
 * Interface for login request action
 */
export interface ILoginRequestAction extends Action {
    readonly type: AuthActionTypes.LOGIN_REQUEST;
}

/**
 * Interface for successful login with MFA status
 */
export interface ILoginSuccessAction extends Action {
    readonly type: AuthActionTypes.LOGIN_SUCCESS;
    readonly payload: {
        readonly user: Readonly<IAuthUser>;
        readonly tokens: Readonly<IAuthTokens>;
        readonly mfaRequired: boolean;
    };
}

/**
 * Interface for login failure with enhanced error typing
 */
export interface ILoginFailureAction extends Action {
    readonly type: AuthActionTypes.LOGIN_FAILURE;
    readonly payload: {
        readonly error: string;
        readonly errorCode?: string;
    };
}

/**
 * Interface for logout action
 */
export interface ILogoutAction extends Action {
    readonly type: AuthActionTypes.LOGOUT;
}

/**
 * Interface for token refresh action
 */
export interface IRefreshTokenAction extends Action {
    readonly type: AuthActionTypes.REFRESH_TOKEN;
    readonly payload: Readonly<IAuthTokens>;
}

/**
 * Interface for MFA requirement notification
 */
export interface IMfaRequiredAction extends Action {
    readonly type: AuthActionTypes.MFA_REQUIRED;
    readonly payload: {
        readonly mfaType: string;
        readonly mfaToken: string;
    };
}

/**
 * Interface for MFA verification attempt
 */
export interface IMfaVerifyAction extends Action {
    readonly type: AuthActionTypes.MFA_VERIFY;
    readonly payload: {
        readonly verificationCode: string;
        readonly mfaToken: string;
    };
}

/**
 * Interface for session expiration notification
 */
export interface ISessionExpiredAction extends Action {
    readonly type: AuthActionTypes.SESSION_EXPIRED;
}

/**
 * Interface for token refresh failure
 */
export interface ITokenRefreshFailureAction extends Action {
    readonly type: AuthActionTypes.TOKEN_REFRESH_FAILURE;
    readonly payload: {
        readonly error: string;
    };
}

/**
 * Union type of all possible authentication actions
 */
export type AuthAction =
    | ILoginRequestAction
    | ILoginSuccessAction
    | ILoginFailureAction
    | ILogoutAction
    | IRefreshTokenAction
    | IMfaRequiredAction
    | IMfaVerifyAction
    | ISessionExpiredAction
    | ITokenRefreshFailureAction;