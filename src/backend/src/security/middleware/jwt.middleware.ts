import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { Logger } from '../../common/utils/logger.util'; // v3.8.0
import { TokenService } from '../services/token.service';
import { IUser } from '../interfaces/user.interface';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { AuthError } from '../../common/interfaces/error.interface';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * JWT Authentication Middleware
 * Validates JWT tokens and enforces OAuth 2.0 security standards
 */

// Initialize logger and token service
const logger = new Logger('JWTMiddleware');
const tokenService = new TokenService();

/**
 * Express middleware for JWT token validation and user authentication
 * Implements secure token validation, user context attachment, and error handling
 */
export const jwtMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.startPerformanceMetric('jwt-validation');

    // Extract token from Authorization header
    const token = extractTokenFromHeader(req);
    if (!token) {
      throw createAuthError('No token provided', ErrorCode.AUTHENTICATION_ERROR);
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      throw createAuthError('Invalid token format', ErrorCode.AUTHENTICATION_ERROR);
    }

    // Verify token and extract payload
    const decodedToken = await tokenService.verifyToken(token);
    if (!decodedToken) {
      throw createAuthError('Invalid token', ErrorCode.AUTHENTICATION_ERROR);
    }

    // Validate token type and expiration
    if (decodedToken.type !== 'access') {
      throw createAuthError('Invalid token type', ErrorCode.AUTHENTICATION_ERROR);
    }

    // Extract user data from token
    const userData: IUser = {
      id: decodedToken.sub,
      email: decodedToken.email,
      role: decodedToken.role
    };

    // Attach user context to request
    const authenticatedReq = req as AuthenticatedRequest;
    authenticatedReq.userId = userData.id;
    authenticatedReq.roles = [userData.role];
    authenticatedReq.permissions = decodedToken.permissions || [];
    authenticatedReq.correlationId = decodedToken.fingerprint;

    logger.info('JWT validation successful', {
      userId: userData.id,
      role: userData.role,
      correlationId: authenticatedReq.correlationId
    });

    logger.endPerformanceMetric('jwt-validation');
    next();
  } catch (error) {
    handleAuthError(error, res);
  }
};

/**
 * Extracts JWT token from request Authorization header
 * @param req - Express request object
 * @returns Extracted token or null if not found/invalid
 */
const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const [bearer, token] = authHeader.split(' ');
  if (bearer !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

/**
 * Validates JWT token format using regex pattern
 * @param token - JWT token string
 * @returns Boolean indicating if token format is valid
 */
const isValidTokenFormat = (token: string): boolean => {
  // JWT format: header.payload.signature
  const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
  return jwtPattern.test(token);
};

/**
 * Creates a standardized authentication error
 * @param message - Error message
 * @param code - Error code
 * @returns AuthError object
 */
const createAuthError = (message: string, code: ErrorCode): AuthError => {
  return {
    code,
    message,
    status: HttpStatus.UNAUTHORIZED,
    timestamp: new Date(),
    details: {
      source: 'JWTMiddleware'
    }
  };
};

/**
 * Handles authentication errors with standardized response format
 * @param error - Error object
 * @param res - Express response object
 */
const handleAuthError = (error: any, res: Response): void => {
  logger.error('Authentication failed', {
    error,
    code: ErrorCode.AUTHENTICATION_ERROR
  });

  const authError: AuthError = {
    code: ErrorCode.AUTHENTICATION_ERROR,
    message: error.message || 'Authentication failed',
    status: HttpStatus.UNAUTHORIZED,
    timestamp: new Date(),
    details: {
      source: 'JWTMiddleware',
      originalError: error.message
    }
  };

  res.status(HttpStatus.UNAUTHORIZED).json(authError);
};