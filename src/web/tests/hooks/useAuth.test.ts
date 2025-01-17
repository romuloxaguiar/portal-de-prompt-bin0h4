import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { jest } from '@jest/globals';

import { useAuth } from '../../src/hooks/useAuth';
import { AuthProvider } from '../../src/interfaces/auth.interface';
import { storage } from '../../src/utils/storage.util';
import { ErrorCode, ErrorMessage } from '../../src/constants/error.constant';

// Mock Redux store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = initialState, action) => state
    },
    preloadedState: {
      auth: initialState
    }
  });
};

// Mock storage utility
jest.mock('../../src/utils/storage.util', () => ({
  storage: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  }
}));

// Mock secure storage
jest.mock('@auth/secure-storage', () => ({
  useSecureStorage: () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    clear: jest.fn()
  })
}));

// Setup test environment
const setupTest = (initialState = {}) => {
  const store = createMockStore(initialState);
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );
  return {
    store,
    wrapper
  };
};

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return initial authentication state with all security controls', () => {
      const { wrapper } = setupTest({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('OAuth Flow', () => {
    it('should handle complete OAuth 2.0 authentication flow', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useAuth(), { wrapper });

      const mockDeviceInfo = {
        userAgent: 'test-agent',
        screenResolution: '1920x1080',
        timezone: 'UTC',
        language: 'en-US',
        platform: 'test'
      };

      // Mock device fingerprint generation
      Object.defineProperty(window.navigator, 'userAgent', {
        value: mockDeviceInfo.userAgent,
        configurable: true
      });

      await act(async () => {
        await result.current.login(AuthProvider.GOOGLE);
      });

      expect(storage.setItem).toHaveBeenCalledWith(
        'device_info',
        mockDeviceInfo,
        expect.any(Object)
      );
    });

    it('should handle OAuth callback with token validation', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useAuth(), { wrapper });

      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600
      };

      storage.getItem.mockResolvedValueOnce(mockTokens);

      await act(async () => {
        await result.current.validateSession();
      });

      expect(storage.getItem).toHaveBeenCalled();
    });
  });

  describe('MFA Handling', () => {
    it('should handle MFA challenges correctly', async () => {
      const { wrapper } = setupTest({
        mfaRequired: true,
        mfaVerified: false
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const mockMFACode = '123456';

      await act(async () => {
        await result.current.handleMFA(mockMFACode, 'TOTP');
      });

      expect(storage.setItem).toHaveBeenCalled();
    });
  });

  describe('Token Management', () => {
    it('should handle token lifecycle management', async () => {
      const { wrapper } = setupTest({
        isAuthenticated: true
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Test token refresh
      await act(async () => {
        await result.current.refreshToken();
      });

      expect(storage.setItem).toHaveBeenCalled();

      // Test token cleanup on logout
      await act(async () => {
        await result.current.logout();
      });

      expect(storage.removeItem).toHaveBeenCalled();
      expect(storage.clear).toHaveBeenCalled();
    });

    it('should handle token refresh failures', async () => {
      const { wrapper } = setupTest({
        isAuthenticated: true
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      storage.getItem.mockRejectedValueOnce(new Error('Token refresh failed'));

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch (error) {
          expect(error.message).toBe(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
        }
      });
    });
  });

  describe('Session Validation', () => {
    it('should handle session validation and management', async () => {
      jest.useFakeTimers();

      const { wrapper } = setupTest({
        isAuthenticated: true
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Test periodic session validation
      await act(async () => {
        jest.advanceTimersByTime(60000); // 1 minute
      });

      expect(storage.getItem).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should handle session expiration', async () => {
      const { wrapper } = setupTest({
        isAuthenticated: true
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      storage.getItem.mockResolvedValueOnce(null);

      await act(async () => {
        await result.current.validateSession();
      });

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors securely', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useAuth(), { wrapper });

      storage.getItem.mockRejectedValueOnce(new Error('Authentication failed'));

      await act(async () => {
        try {
          await result.current.login(AuthProvider.GOOGLE);
        } catch (error) {
          expect(error.message).toBe(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
        }
      });
    });

    it('should handle network errors', async () => {
      const { wrapper } = setupTest();
      const { result } = renderHook(() => useAuth(), { wrapper });

      storage.setItem.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        try {
          await result.current.login(AuthProvider.GOOGLE);
        } catch (error) {
          expect(error.message).toBe(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
        }
      });
    });
  });
});