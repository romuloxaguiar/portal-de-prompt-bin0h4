import React, { useEffect, useCallback, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled } from 'styled-components';
import useAnalytics from '@analytics/react';

import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { theme } from '../styles/theme.styles';

// Route constants
const DASHBOARD_ROUTE = '/dashboard';
const MFA_CHALLENGE_ROUTE = '/auth/mfa';

// Styled components
const LoginContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${theme.spacing(3)}px;
  background-color: ${({ theme }) => theme.palette.background.default};

  @media (prefers-reduced-motion: no-preference) {
    transition: background-color 0.3s ease;
  }
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 400px;
  padding: ${theme.spacing(4)}px;
  border-radius: ${theme.shape.borderRadius}px;
  box-shadow: ${theme.shadows[1]};
  background-color: ${({ theme }) => theme.palette.background.paper};

  @media (max-width: 768px) {
    padding: ${theme.spacing(3)}px;
  }
`;

const LoginPage: React.FC = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { track } = useAnalytics();
  const { isAuthenticated, loading, error } = useAuth();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      const redirectPath = location.state?.from?.pathname || DASHBOARD_ROUTE;
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, location]);

  // Handle successful login
  const handleLoginSuccess = useCallback(async (response: any) => {
    track('login_success', {
      provider: response.provider,
      timestamp: new Date().toISOString()
    });

    if (response.mfaRequired) {
      navigate(MFA_CHALLENGE_ROUTE, {
        state: { challengeId: response.challengeId }
      });
    } else {
      const redirectPath = location.state?.from?.pathname || DASHBOARD_ROUTE;
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, location, track]);

  // Handle login error
  const handleLoginError = useCallback((error: Error) => {
    track('login_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }, [track]);

  // Handle MFA requirement
  const handleMFARequired = useCallback((challengeId: string) => {
    navigate(MFA_CHALLENGE_ROUTE, {
      state: { challengeId }
    });
  }, [navigate]);

  return (
    <ErrorBoundary>
      <LoginContainer>
        <LoginCard
          role="main"
          aria-labelledby="login-title"
        >
          <h1
            id="login-title"
            style={{
              fontSize: theme.typography.h4.fontSize,
              marginBottom: theme.spacing(3),
              textAlign: 'center'
            }}
          >
            Sign in to Prompts Portal
          </h1>

          <LoginForm
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            onMFARequired={handleMFARequired}
          />

          {error && (
            <div
              role="alert"
              aria-live="polite"
              style={{
                color: theme.palette.error.main,
                marginTop: theme.spacing(2),
                textAlign: 'center'
              }}
            >
              {error.message}
            </div>
          )}
        </LoginCard>
      </LoginContainer>
    </ErrorBoundary>
  );
});

LoginPage.displayName = 'LoginPage';

export default LoginPage;