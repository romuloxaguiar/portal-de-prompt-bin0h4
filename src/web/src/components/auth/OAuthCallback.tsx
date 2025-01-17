/**
 * OAuth 2.0 callback handler component with enhanced security features
 * Implements secure token handling, MFA support, and comprehensive error management
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import AuthService from '../../services/auth.service';
import Loading from '../common/Loading';
import ErrorBoundary from '../common/ErrorBoundary';
import { ErrorCode, ErrorMessage } from '../../constants/error.constant';
import { storage, StorageKeys } from '../../utils/storage.util';

// Constants
const DEFAULT_REDIRECT = '/dashboard';
const CALLBACK_TIMEOUT = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Component that handles OAuth callback processing with enhanced security
 */
const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, handleMFAChallenge } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let mounted = true;

    /**
     * Processes OAuth callback with security validations
     */
    const processCallback = async () => {
      try {
        // Extract URL parameters
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        // Handle OAuth error response
        if (error) {
          throw new Error(error);
        }

        // Validate required parameters
        if (!code || !state) {
          throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
        }

        // Retrieve stored auth state
        const storedAuth = await storage.getItem<{
          state: string;
          codeVerifier: string;
          provider: string;
        }>(StorageKeys.AUTH_STATE);

        // Validate state parameter to prevent CSRF
        if (!storedAuth || storedAuth.state !== state) {
          throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
        }

        // Verify PKCE challenge
        const isValidPKCE = await AuthService.verifyPKCE(
          code,
          storedAuth.codeVerifier
        );

        if (!isValidPKCE) {
          throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
        }

        // Process OAuth callback
        const response = await AuthService.handleCallback(
          code,
          state,
          storedAuth.codeVerifier
        );

        // Handle MFA if required
        if ('challengeId' in response) {
          if (mounted) {
            await handleMFAChallenge(response.challengeId, response.mfaType);
          }
          return;
        }

        // Navigate to success destination
        if (mounted) {
          const returnUrl = sessionStorage.getItem('returnUrl') || DEFAULT_REDIRECT;
          sessionStorage.removeItem('returnUrl');
          navigate(returnUrl, { replace: true });
        }
      } catch (error) {
        if (mounted) {
          console.error('OAuth callback error:', error);
          setError(
            error instanceof Error ? error.message : ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]
          );
          navigate('/login', { replace: true });
        }
      } finally {
        // Clean up sensitive data
        await storage.removeItem(StorageKeys.AUTH_STATE);
      }
    };

    // Set timeout for callback processing
    timeoutId = setTimeout(() => {
      if (mounted) {
        setError('Authentication timeout');
        navigate('/login', { replace: true });
      }
    }, CALLBACK_TIMEOUT);

    // Process callback
    processCallback();

    // Cleanup function
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [navigate, location, login, handleMFAChallenge]);

  // Show error state
  if (error) {
    return (
      <div role="alert" className="oauth-callback-error">
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/login')} className="retry-button">
          Return to Login
        </button>
      </div>
    );
  }

  // Show loading state
  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="oauth-callback-error">
          <h2>Authentication Failed</h2>
          <p>Please try again or contact support if the issue persists.</p>
          <button onClick={() => navigate('/login')} className="retry-button">
            Return to Login
          </button>
        </div>
      }
    >
      <div className="oauth-callback-loading">
        <Loading
          size="large"
          color="primary"
          overlay={true}
          ariaLabel="Completing authentication..."
        />
      </div>
    </ErrorBoundary>
  );
};

export default OAuthCallback;