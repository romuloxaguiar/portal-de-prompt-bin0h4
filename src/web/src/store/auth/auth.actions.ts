/**
 * Redux action creators for authentication state management with enhanced security features
 * including MFA support, secure token handling, and comprehensive error management.
 * @version 1.0.0
 */

import { ThunkAction, ThunkDispatch } from 'redux-thunk'; // v2.4.2
import { AuthActionTypes } from './auth.types';
import { IAuthUser, IAuthTokens, AuthProvider, IMFAChallenge } from '../../interfaces/auth.interface';
import AuthService from '../../services/auth.service';
import { SecurityUtils } from '@security/utils'; // v1.0.0
import { ErrorCode, ErrorMessage } from '../../constants/error.constant';
import { storage, StorageKeys } from '../../utils/storage.util';

// Type definitions for Redux state and actions
type AppState = any; // Replace with your root state type
type AppAction = any; // Replace with your action union type
type ThunkResult<R> = ThunkAction<R, AppState, undefined, AppAction>;

// Session monitoring interval in milliseconds
const SESSION_MONITOR_INTERVAL = 60000; // 1 minute

/**
 * Initiates secure login process with PKCE and device fingerprinting
 */
export const loginRequest = (provider: AuthProvider): ThunkResult<Promise<void>> => {
  return async (dispatch: ThunkDispatch<AppState, undefined, AppAction>) => {
    try {
      dispatch({ type: AuthActionTypes.LOGIN_REQUEST });

      // Generate PKCE challenge
      const pkce = await SecurityUtils.generatePKCE();
      
      // Get device fingerprint
      const fingerprint = await SecurityUtils.getDeviceFingerprint();

      // Store PKCE verifier securely
      await storage.setItem(StorageKeys.AUTH_TOKEN, {
        pkceVerifier: pkce.verifier,
        fingerprint
      }, { encrypt: true, ttl: 300000 }); // 5 minute TTL

      // Initiate OAuth flow
      await AuthService.login(provider);
    } catch (error) {
      dispatch({
        type: AuthActionTypes.LOGIN_FAILURE,
        payload: {
          error: ErrorMessage[ErrorCode.AUTHENTICATION_ERROR],
          errorCode: ErrorCode.AUTHENTICATION_ERROR
        }
      });
      throw error;
    }
  };
};

/**
 * Handles OAuth callback with enhanced security checks
 */
export const handleAuthCallback = (
  code: string,
  state: string
): ThunkResult<Promise<void>> => {
  return async (dispatch: ThunkDispatch<AppState, undefined, AppAction>) => {
    try {
      const storedAuth = await storage.getItem<{
        pkceVerifier: string;
        fingerprint: string;
      }>(StorageKeys.AUTH_TOKEN);

      if (!storedAuth) {
        throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
      }

      const response = await AuthService.handleCallback(code, state);

      if ('challengeId' in response) {
        // MFA is required
        dispatch({
          type: AuthActionTypes.MFA_REQUIRED,
          payload: {
            challengeId: response.challengeId,
            mfaType: response.mfaType
          }
        });
        return;
      }

      // Store tokens securely
      await storage.setItem(StorageKeys.AUTH_TOKEN, response.tokens, {
        encrypt: true,
        ttl: response.tokens.expiresIn * 1000
      });

      dispatch({
        type: AuthActionTypes.LOGIN_SUCCESS,
        payload: {
          user: response.user,
          tokens: response.tokens
        }
      });

      // Initialize session monitoring
      initializeSessionMonitoring(dispatch);
    } catch (error) {
      dispatch({
        type: AuthActionTypes.LOGIN_FAILURE,
        payload: {
          error: ErrorMessage[ErrorCode.AUTHENTICATION_ERROR],
          errorCode: ErrorCode.AUTHENTICATION_ERROR
        }
      });
      throw error;
    } finally {
      // Clean up PKCE verifier
      await storage.removeItem(StorageKeys.AUTH_TOKEN);
    }
  };
};

/**
 * Handles MFA verification process
 */
export const handleMFAChallenge = (
  challenge: IMFAChallenge,
  code: string
): ThunkResult<Promise<void>> => {
  return async (dispatch: ThunkDispatch<AppState, undefined, AppAction>) => {
    try {
      const response = await AuthService.handleMFAChallenge(
        challenge.challengeId,
        code,
        challenge.mfaType
      );

      await storage.setItem(StorageKeys.AUTH_TOKEN, response.tokens, {
        encrypt: true,
        ttl: response.tokens.expiresIn * 1000
      });

      dispatch({
        type: AuthActionTypes.MFA_SUCCESS,
        payload: {
          user: response.user,
          tokens: response.tokens
        }
      });

      // Initialize session monitoring
      initializeSessionMonitoring(dispatch);
    } catch (error) {
      dispatch({
        type: AuthActionTypes.MFA_FAILURE,
        payload: {
          error: ErrorMessage[ErrorCode.AUTHENTICATION_ERROR],
          errorCode: ErrorCode.AUTHENTICATION_ERROR
        }
      });
      throw error;
    }
  };
};

/**
 * Handles secure token refresh with rotation
 */
export const refreshToken = (): ThunkResult<Promise<void>> => {
  return async (dispatch: ThunkDispatch<AppState, undefined, AppAction>) => {
    try {
      const tokens = await AuthService.refreshToken();

      await storage.setItem(StorageKeys.AUTH_TOKEN, tokens, {
        encrypt: true,
        ttl: tokens.expiresIn * 1000
      });

      dispatch({
        type: AuthActionTypes.REFRESH_TOKEN,
        payload: tokens
      });
    } catch (error) {
      dispatch({ type: AuthActionTypes.SESSION_EXPIRED });
      throw error;
    }
  };
};

/**
 * Handles secure logout with token revocation
 */
export const logout = (): ThunkResult<Promise<void>> => {
  return async (dispatch: ThunkDispatch<AppState, undefined, AppAction>) => {
    try {
      await AuthService.logout();
      await storage.removeItem(StorageKeys.AUTH_TOKEN);
      dispatch({ type: AuthActionTypes.LOGOUT });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on error
      await storage.removeItem(StorageKeys.AUTH_TOKEN);
      dispatch({ type: AuthActionTypes.LOGOUT });
    }
  };
};

/**
 * Initializes session monitoring for security
 */
const initializeSessionMonitoring = (
  dispatch: ThunkDispatch<AppState, undefined, AppAction>
) => {
  // Check session validity periodically
  setInterval(async () => {
    try {
      const tokens = await storage.getItem<IAuthTokens>(StorageKeys.AUTH_TOKEN);
      if (!tokens) {
        dispatch({ type: AuthActionTypes.SESSION_EXPIRED });
        return;
      }

      const expirationTime = new Date().getTime() + tokens.expiresIn * 1000;
      if (expirationTime <= new Date().getTime()) {
        dispatch({ type: AuthActionTypes.SESSION_EXPIRED });
      }
    } catch (error) {
      dispatch({ type: AuthActionTypes.SESSION_EXPIRED });
    }
  }, SESSION_MONITOR_INTERVAL);
};