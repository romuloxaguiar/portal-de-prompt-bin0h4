/**
 * Custom React hook providing secure authentication functionality with OAuth 2.0 support,
 * MFA handling, secure token management, and real-time session monitoring.
 * @version 1.0.0
 */

import { useEffect, useCallback } from 'react'; // v18.0.0
import { useDispatch, useSelector } from 'react-redux'; // v8.0.0
import { useSecureStorage } from '@auth/secure-storage'; // v1.0.0

import {
  loginRequest,
  logout,
  refreshToken,
  handleMFAChallenge,
  validateSession
} from '../store/auth/auth.actions';

import {
  selectIsAuthenticated,
  selectAuthUser,
  selectAuthLoading,
  selectAuthError
} from '../store/auth/auth.selectors';

import { AuthProvider, MFAMethod } from '../interfaces/auth.interface';
import { ErrorCode, ErrorMessage } from '../constants/error.constant';
import { storage, StorageKeys } from '../utils/storage.util';

// Constants for token refresh and session validation intervals
const TOKEN_REFRESH_INTERVAL = 300000; // 5 minutes
const SESSION_VALIDATION_INTERVAL = 60000; // 1 minute
const MAX_REFRESH_RETRIES = 3;

/**
 * Interface for device fingerprint data used in authentication
 */
interface DeviceInfo {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
}

/**
 * Custom hook providing comprehensive authentication functionality
 * @returns Enhanced authentication state and methods
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const secureStorage = useSecureStorage();

  // Select authentication state from Redux store
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectAuthUser);
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);

  /**
   * Generates device fingerprint for enhanced security
   */
  const generateDeviceFingerprint = useCallback((): DeviceInfo => {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform
    };
  }, []);

  /**
   * Handles secure login process with device fingerprinting and MFA support
   */
  const handleLogin = useCallback(async (provider: AuthProvider) => {
    try {
      const deviceInfo = generateDeviceFingerprint();
      
      // Store device info securely for validation
      await secureStorage.setItem('device_info', deviceInfo, {
        encrypt: true,
        ttl: TOKEN_REFRESH_INTERVAL
      });

      await dispatch(loginRequest(provider));
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
    }
  }, [dispatch, generateDeviceFingerprint, secureStorage]);

  /**
   * Handles secure logout with token invalidation
   */
  const handleLogout = useCallback(async () => {
    try {
      await dispatch(logout());
      await secureStorage.clear();
      await storage.removeItem(StorageKeys.AUTH_TOKEN);
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on error
      await secureStorage.clear();
      await storage.removeItem(StorageKeys.AUTH_TOKEN);
    }
  }, [dispatch, secureStorage]);

  /**
   * Handles MFA challenge verification
   */
  const handleMFA = useCallback(async (code: string, method: MFAMethod) => {
    try {
      const deviceInfo = generateDeviceFingerprint();
      await dispatch(handleMFAChallenge({ code, method, deviceInfo }));
    } catch (error) {
      console.error('MFA error:', error);
      throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
    }
  }, [dispatch, generateDeviceFingerprint]);

  /**
   * Handles secure token refresh with retry logic
   */
  const handleTokenRefresh = useCallback(async (retryCount = 0) => {
    try {
      const deviceInfo = generateDeviceFingerprint();
      await dispatch(refreshToken(deviceInfo));
    } catch (error) {
      if (retryCount < MAX_REFRESH_RETRIES) {
        setTimeout(() => handleTokenRefresh(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        await handleLogout();
      }
    }
  }, [dispatch, generateDeviceFingerprint, handleLogout]);

  /**
   * Sets up token refresh interval
   */
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    
    if (isAuthenticated) {
      refreshInterval = setInterval(handleTokenRefresh, TOKEN_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isAuthenticated, handleTokenRefresh]);

  /**
   * Sets up session validation interval
   */
  useEffect(() => {
    let validationInterval: NodeJS.Timeout;

    if (isAuthenticated) {
      validationInterval = setInterval(async () => {
        try {
          const isValid = await dispatch(validateSession());
          if (!isValid) {
            await handleLogout();
          }
        } catch (error) {
          await handleLogout();
        }
      }, SESSION_VALIDATION_INTERVAL);
    }

    return () => {
      if (validationInterval) {
        clearInterval(validationInterval);
      }
    };
  }, [isAuthenticated, dispatch, handleLogout]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      secureStorage.clear().catch(console.error);
    };
  }, [secureStorage]);

  return {
    isAuthenticated,
    user,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
    refreshToken: handleTokenRefresh,
    handleMFA,
    validateSession: useCallback(() => dispatch(validateSession()), [dispatch])
  };
};

export default useAuth;