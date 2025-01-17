import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import LoginForm from '../../../src/components/auth/LoginForm';
import { useAuth } from '../../../src/hooks/useAuth';
import { AuthProvider } from '../../../src/interfaces/auth.interface';
import { ErrorCode, ErrorMessage } from '../../../src/constants/error.constant';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../../src/hooks/useAuth');
jest.mock('@fingerprintjs/fingerprintjs-pro');

// Mock store configuration
const createMockStore = () => configureStore({
  reducer: {
    auth: (state = {}, action) => state
  }
});

// Test data
const mockUser = {
  email: 'test@example.com',
  password: 'Test123!@#',
  deviceFingerprint: 'mock-fingerprint-123'
};

// Enhanced render helper with auth context and store
const renderWithAuth = (
  ui: React.ReactElement,
  {
    initialState = {},
    store = createMockStore(),
    authConfig = {
      login: jest.fn(),
      loading: false,
      error: null,
      handleMFAChallenge: jest.fn()
    }
  } = {}
) => {
  (useAuth as jest.Mock).mockReturnValue(authConfig);
  
  return {
    ...render(
      <Provider store={store}>
        {ui}
      </Provider>
    ),
    store,
    authConfig
  };
};

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithAuth(<LoginForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      renderWithAuth(<LoginForm />);
      
      expect(screen.getByRole('form')).toHaveAttribute('aria-labelledby', 'login-title');
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Remember me')).toBeInTheDocument();
    });

    it('should handle keyboard navigation correctly', async () => {
      renderWithAuth(<LoginForm />);
      const user = userEvent.setup();

      // Test tab order
      await user.tab();
      expect(screen.getByLabelText('Email address')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText('Password')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByLabelText('Remember me')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      const mockLogin = jest.fn().mockResolvedValue({ success: true });
      const onSuccess = jest.fn();
      
      renderWithAuth(
        <LoginForm onSuccess={onSuccess} />,
        { authConfig: { login: mockLogin, loading: false, error: null } }
      );

      await userEvent.type(screen.getByLabelText('Email address'), mockUser.email);
      await userEvent.type(screen.getByLabelText('Password'), mockUser.password);
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: mockUser.email,
          password: mockUser.password,
          deviceFingerprint: expect.any(String),
          rememberMe: false
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('should handle MFA challenge', async () => {
      const mockLogin = jest.fn().mockResolvedValue({ mfaRequired: true });
      const mockHandleMFA = jest.fn().mockResolvedValue({ success: true });
      
      renderWithAuth(
        <LoginForm />,
        {
          authConfig: {
            login: mockLogin,
            handleMFAChallenge: mockHandleMFA,
            loading: false,
            error: null
          }
        }
      );

      // Initial login
      await userEvent.type(screen.getByLabelText('Email address'), mockUser.email);
      await userEvent.type(screen.getByLabelText('Password'), mockUser.password);
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      // MFA verification
      await waitFor(() => {
        expect(screen.getByLabelText('MFA verification code')).toBeInTheDocument();
      });

      await userEvent.type(screen.getByLabelText('MFA verification code'), '123456');
      await userEvent.click(screen.getByRole('button', { name: 'Verify MFA code' }));

      await waitFor(() => {
        expect(mockHandleMFA).toHaveBeenCalledWith('123456');
      });
    });

    it('should handle rate limiting', async () => {
      const mockLogin = jest.fn().mockRejectedValue(new Error('Invalid credentials'));
      
      renderWithAuth(
        <LoginForm />,
        { authConfig: { login: mockLogin, loading: false, error: null } }
      );

      // Attempt multiple failed logins
      for (let i = 0; i < 3; i++) {
        await userEvent.type(screen.getByLabelText('Email address'), mockUser.email);
        await userEvent.type(screen.getByLabelText('Password'), 'wrong');
        await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      }

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again in 5 minutes.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
      });
    });
  });

  describe('Security Features', () => {
    it('should validate email format', async () => {
      renderWithAuth(<LoginForm />);

      await userEvent.type(screen.getByLabelText('Email address'), 'invalid-email');
      await userEvent.tab(); // Trigger blur validation

      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    it('should validate password requirements', async () => {
      renderWithAuth(<LoginForm />);

      await userEvent.type(screen.getByLabelText('Password'), 'weak');
      await userEvent.tab(); // Trigger blur validation

      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('should handle device fingerprinting', async () => {
      const mockLogin = jest.fn().mockResolvedValue({ success: true });
      
      renderWithAuth(
        <LoginForm />,
        { authConfig: { login: mockLogin, loading: false, error: null } }
      );

      await userEvent.type(screen.getByLabelText('Email address'), mockUser.email);
      await userEvent.type(screen.getByLabelText('Password'), mockUser.password);
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceFingerprint: expect.any(String)
          })
        );
      });
    });
  });

  describe('OAuth Providers', () => {
    it('should render OAuth provider buttons', () => {
      renderWithAuth(<LoginForm />);

      Object.values(AuthProvider).forEach(provider => {
        expect(screen.getByRole('button', { name: `Sign in with ${provider}` })).toBeInTheDocument();
      });
    });

    it('should handle OAuth provider login', async () => {
      const mockLogin = jest.fn().mockResolvedValue({ success: true });
      
      renderWithAuth(
        <LoginForm />,
        { authConfig: { login: mockLogin, loading: false, error: null } }
      );

      await userEvent.click(screen.getByRole('button', { name: `Sign in with ${AuthProvider.GOOGLE}` }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          provider: AuthProvider.GOOGLE,
          deviceFingerprint: expect.any(String)
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should display authentication errors', async () => {
      const mockLogin = jest.fn().mockRejectedValue(new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]));
      
      renderWithAuth(
        <LoginForm />,
        { authConfig: { login: mockLogin, loading: false, error: ErrorMessage[ErrorCode.AUTHENTICATION_ERROR] } }
      );

      await userEvent.type(screen.getByLabelText('Email address'), mockUser.email);
      await userEvent.type(screen.getByLabelText('Password'), mockUser.password);
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
      });
    });

    it('should handle network errors', async () => {
      const mockLogin = jest.fn().mockRejectedValue(new Error(ErrorMessage[ErrorCode.NETWORK_ERROR]));
      
      renderWithAuth(
        <LoginForm />,
        { authConfig: { login: mockLogin, loading: false, error: ErrorMessage[ErrorCode.NETWORK_ERROR] } }
      );

      await userEvent.type(screen.getByLabelText('Email address'), mockUser.email);
      await userEvent.type(screen.getByLabelText('Password'), mockUser.password);
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(ErrorMessage[ErrorCode.NETWORK_ERROR]);
      });
    });
  });
});