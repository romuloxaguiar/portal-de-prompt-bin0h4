/**
 * @fileoverview Authentication and Authorization Request Validator
 * Implements comprehensive validation logic for authentication-related requests
 * with enhanced security controls and OWASP compliance.
 * 
 * @version 1.0.0
 */

import { validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'; // v0.14.0
import validator from 'validator'; // v13.9.0
import { IUser, UserStatus } from '../interfaces/user.interface';
import { validateString, ValidationResult } from '../../common/utils/validation.util';
import { ValidationError } from '../../common/interfaces/error.interface';
import { ErrorCode } from '../../common/constants/error-codes.constant';

/**
 * Constants for validation rules
 */
const AUTH_VALIDATION_RULES = {
  PASSWORD: {
    MIN_LENGTH: 12,
    MAX_LENGTH: 128,
    REQUIRED_PATTERNS: [
      /[A-Z]/,      // uppercase
      /[a-z]/,      // lowercase
      /[0-9]/,      // numbers
      /[^A-Za-z0-9]/ // special characters
    ]
  },
  EMAIL: {
    MAX_LENGTH: 255,
    ALLOWED_PATTERN: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  },
  RATE_LIMIT: {
    MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000 // 15 minutes
  }
};

/**
 * Interface for tracking validation metrics
 */
interface AuthValidationMetrics {
  timestamp: Date;
  validationType: string;
  duration: number;
  failedChecks: number;
  totalChecks: number;
}

/**
 * Decorator-based validator for login requests
 */
@ValidatorConstraint({ name: 'loginRequestValidator', async: true })
export class LoginRequestValidator implements ValidatorConstraintInterface {
  private metrics: AuthValidationMetrics;

  constructor() {
    this.metrics = {
      timestamp: new Date(),
      validationType: 'login',
      duration: 0,
      failedChecks: 0,
      totalChecks: 0
    };
  }

  async validate(loginData: Partial<IUser>): Promise<boolean> {
    const startTime = Date.now();
    const result = await validateLoginRequest(loginData);
    
    this.metrics = {
      timestamp: new Date(),
      validationType: 'login',
      duration: Date.now() - startTime,
      failedChecks: result.metrics.failedChecks,
      totalChecks: result.metrics.totalChecks
    };

    return result.isValid;
  }

  defaultMessage(): string {
    return 'Login request validation failed';
  }
}

/**
 * Validates login request data with enhanced security checks
 * 
 * @param loginData - Login request data containing email and password
 * @returns ValidationResult with detailed error messages and validation metrics
 */
export async function validateLoginRequest(loginData: Partial<IUser>): Promise<ValidationResult> {
  const startTime = Date.now();
  const result = new ValidationResult();
  let checks = 0;

  // Email validation
  checks++;
  if (!loginData.email) {
    result.addError('email', 'Email is required', 'requirement');
  } else {
    const emailValidation = validateString(loginData.email, {
      required: true,
      maxLength: AUTH_VALIDATION_RULES.EMAIL.MAX_LENGTH,
      allowedCharacters: AUTH_VALIDATION_RULES.EMAIL.ALLOWED_PATTERN
    });

    if (!emailValidation.isValid) {
      result.errors.push(...emailValidation.errors);
    }

    // Enhanced email validation
    checks++;
    if (!validator.isEmail(loginData.email)) {
      result.addError('email', 'Invalid email format', 'format');
    }

    // Check for disposable email services
    checks++;
    if (await validator.isDisposableEmail(loginData.email)) {
      result.addError('email', 'Disposable email addresses are not allowed', 'security');
    }
  }

  // Password validation
  checks++;
  if (!loginData.password) {
    result.addError('password', 'Password is required', 'requirement');
  } else {
    const passwordValidation = validateString(loginData.password, {
      required: true,
      minLength: AUTH_VALIDATION_RULES.PASSWORD.MIN_LENGTH,
      maxLength: AUTH_VALIDATION_RULES.PASSWORD.MAX_LENGTH
    });

    if (!passwordValidation.isValid) {
      result.errors.push(...passwordValidation.errors);
    }

    // Check password complexity
    checks++;
    AUTH_VALIDATION_RULES.PASSWORD.REQUIRED_PATTERNS.forEach(pattern => {
      if (!pattern.test(loginData.password!)) {
        result.addError('password', 'Password does not meet complexity requirements', 'security');
      }
    });
  }

  result.updateMetrics(checks, Date.now() - startTime, 'login');
  return result;
}

/**
 * Validates registration request data with strict security controls
 * 
 * @param registrationData - Registration request data
 * @returns ValidationResult with security recommendations
 */
export async function validateRegistrationRequest(registrationData: IUser): Promise<ValidationResult> {
  const startTime = Date.now();
  const result = new ValidationResult();
  let checks = 0;

  // Validate login credentials
  const loginValidation = await validateLoginRequest({
    email: registrationData.email,
    password: registrationData.password
  });

  if (!loginValidation.isValid) {
    result.errors.push(...loginValidation.errors);
  }

  // Validate name fields
  checks++;
  if (!registrationData.firstName || !registrationData.lastName) {
    result.addError('name', 'First and last name are required', 'requirement');
  } else {
    const nameValidation = validateString(registrationData.firstName + registrationData.lastName, {
      allowedCharacters: /^[a-zA-Z\s-']+$/,
      maxLength: 100
    });

    if (!nameValidation.isValid) {
      result.errors.push(...nameValidation.errors);
    }
  }

  // Additional security checks
  checks++;
  if (registrationData.status !== UserStatus.PENDING) {
    result.addError('status', 'Invalid initial user status', 'security');
  }

  result.updateMetrics(checks, Date.now() - startTime, 'registration');
  return result;
}

/**
 * Validates password reset request data with enhanced security
 * 
 * @param resetData - Password reset request data
 * @returns ValidationResult with security checks
 */
export async function validatePasswordReset(resetData: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<ValidationResult> {
  const startTime = Date.now();
  const result = new ValidationResult();
  let checks = 0;

  // Email validation
  const emailValidation = await validateLoginRequest({ email: resetData.email });
  if (!emailValidation.isValid) {
    result.errors.push(...emailValidation.errors);
  }

  // Token validation
  checks++;
  if (!resetData.token || !validator.isJWT(resetData.token)) {
    result.addError('token', 'Invalid reset token', 'security');
  }

  // New password validation
  checks++;
  const passwordValidation = validateString(resetData.newPassword, {
    required: true,
    minLength: AUTH_VALIDATION_RULES.PASSWORD.MIN_LENGTH,
    maxLength: AUTH_VALIDATION_RULES.PASSWORD.MAX_LENGTH
  });

  if (!passwordValidation.isValid) {
    result.errors.push(...passwordValidation.errors);
  }

  // Password complexity check
  checks++;
  AUTH_VALIDATION_RULES.PASSWORD.REQUIRED_PATTERNS.forEach(pattern => {
    if (!pattern.test(resetData.newPassword)) {
      result.addError('newPassword', 'New password does not meet complexity requirements', 'security');
    }
  });

  result.updateMetrics(checks, Date.now() - startTime, 'passwordReset');
  return result;
}