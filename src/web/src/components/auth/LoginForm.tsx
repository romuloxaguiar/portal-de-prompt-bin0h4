import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form'; // v7.0.0
import * as yup from 'yup'; // v1.0.0
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro'; // v3.0.0

import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { AuthProvider } from '../../interfaces/auth.interface';
import { validateEmail, sanitizeInput } from '../../utils/validation.util';
import { ErrorCode, ErrorMessage } from '../../constants/error.constant';

// Validation schema for login form
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
      'Password must contain at least one letter and one number'
    ),
  rememberMe: yup.boolean()
});

interface LoginFormProps {
  onSuccess?: (authResult: any) => void;
  redirectUrl?: string;
  mfaEnabled?: boolean;
}

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
  deviceFingerprint: string;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  redirectUrl,
  mfaEnabled = false
}) => {
  // Initialize form handling with validation
  const { register, handleSubmit, formState: { errors }, setError } = useForm<LoginFormData>({
    mode: 'onBlur',
    resolver: yup.reach(validationSchema)
  });

  // Get authentication hooks and state
  const { login, loading, error, handleMFAChallenge } = useAuth();

  // Local state management
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [mfaCode, setMfaCode] = useState<string>('');
  const [showMfaInput, setShowMfaInput] = useState<boolean>(false);
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);

  // Constants for rate limiting
  const MAX_LOGIN_ATTEMPTS = 3;
  const RATE_LIMIT_DURATION = 300000; // 5 minutes

  // Initialize device fingerprinting
  useEffect(() => {
    const initializeFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load({
          apiKey: process.env.REACT_APP_FINGERPRINT_API_KEY
        });
        const result = await fp.get();
        setDeviceFingerprint(result.visitorId);
      } catch (error) {
        console.error('Error initializing fingerprint:', error);
      }
    };

    initializeFingerprint();
  }, []);

  // Handle rate limiting
  useEffect(() => {
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      setIsRateLimited(true);
      const timer = setTimeout(() => {
        setIsRateLimited(false);
        setLoginAttempts(0);
      }, RATE_LIMIT_DURATION);

      return () => clearTimeout(timer);
    }
  }, [loginAttempts]);

  // Handle form submission
  const onSubmit = useCallback(async (data: LoginFormData) => {
    if (isRateLimited) {
      return;
    }

    try {
      // Sanitize and validate input
      const sanitizedEmail = sanitizeInput(data.email);
      if (!validateEmail(sanitizedEmail)) {
        setError('email', { message: 'Invalid email format' });
        return;
      }

      // Increment login attempts
      setLoginAttempts(prev => prev + 1);

      // Attempt login with device fingerprint
      const result = await login({
        email: sanitizedEmail,
        password: data.password,
        deviceFingerprint,
        rememberMe: data.rememberMe
      });

      // Handle MFA if required
      if (result?.mfaRequired) {
        setShowMfaInput(true);
      } else if (onSuccess) {
        onSuccess(result);
      } else if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('password', { message: ErrorMessage[ErrorCode.AUTHENTICATION_ERROR] });
    }
  }, [login, deviceFingerprint, isRateLimited, onSuccess, redirectUrl, setError]);

  // Handle MFA verification
  const handleMfaSubmit = useCallback(async () => {
    try {
      const result = await handleMFAChallenge(mfaCode);
      if (result.success) {
        if (onSuccess) {
          onSuccess(result);
        } else if (redirectUrl) {
          window.location.href = redirectUrl;
        }
      }
    } catch (error) {
      console.error('MFA error:', error);
      setError('mfaCode', { message: 'Invalid MFA code' });
    }
  }, [mfaCode, handleMFAChallenge, onSuccess, redirectUrl, setError]);

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      aria-labelledby="login-title"
      noValidate
    >
      <h1 id="login-title" className="visually-hidden">Login to Prompts Portal</h1>

      <Input
        {...register('email')}
        type="email"
        placeholder="Email address"
        error={!!errors.email}
        helperText={errors.email?.message}
        disabled={loading || isRateLimited}
        aria-label="Email address"
        required
      />

      <Input
        {...register('password')}
        type="password"
        placeholder="Password"
        error={!!errors.password}
        helperText={errors.password?.message}
        disabled={loading || isRateLimited}
        aria-label="Password"
        required
      />

      {showMfaInput && (
        <Input
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          type="text"
          placeholder="Enter MFA code"
          error={!!errors.mfaCode}
          helperText={errors.mfaCode?.message}
          disabled={loading}
          aria-label="MFA verification code"
          maxLength={6}
          pattern="[0-9]*"
        />
      )}

      <div className="form-controls">
        <label className="remember-me">
          <input
            {...register('rememberMe')}
            type="checkbox"
            aria-label="Remember me"
          />
          Remember me
        </label>

        {isRateLimited && (
          <div 
            role="alert" 
            className="rate-limit-warning"
            aria-live="polite"
          >
            Too many attempts. Please try again in 5 minutes.
          </div>
        )}

        {error && (
          <div 
            role="alert" 
            className="error-message"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || isRateLimited}
          loading={loading}
          fullWidth
          aria-label={showMfaInput ? "Verify MFA code" : "Sign in"}
          onClick={showMfaInput ? handleMfaSubmit : undefined}
        >
          {showMfaInput ? "Verify" : "Sign in"}
        </Button>
      </div>

      <div className="oauth-providers" aria-label="Sign in with other providers">
        {Object.values(AuthProvider).map((provider) => (
          <Button
            key={provider}
            variant="outlined"
            onClick={() => login({ provider, deviceFingerprint })}
            disabled={loading || isRateLimited}
            aria-label={`Sign in with ${provider}`}
          >
            Continue with {provider}
          </Button>
        ))}
      </div>
    </form>
  );
};

export default React.memo(LoginForm);