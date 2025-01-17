/**
 * Authentication Routes Configuration
 * Implements secure OAuth 2.0 authentication flow with comprehensive security controls
 * including MFA, rate limiting, request validation, and audit logging.
 * @version 1.0.0
 */

import express, { Router, Request, Response, NextFunction } from 'express'; // v4.18.2
import helmet from 'helmet'; // v7.0.0
import cors from 'cors'; // v2.8.5
import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { AuthController } from '../controllers/auth.controller';
import { jwtMiddleware } from '../middleware/jwt.middleware';
import { validateLoginRequest, validateRegistrationRequest } from '../validators/auth.validator';
import { Logger } from '../../common/utils/logger.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { ValidationError } from '../../common/interfaces/error.interface';

// Initialize router and dependencies
const router: Router = express.Router();
const logger = new Logger('AuthRoutes');
const authController = new AuthController();

// Configure rate limiter for authentication endpoints
const rateLimiter = new RateLimiterMemory({
    points: 5, // Number of attempts
    duration: 300, // Per 5 minutes
    blockDuration: 900 // 15 minutes block
});

// Apply security middleware
router.use(helmet({
    hidePoweredBy: true,
    noSniff: true,
    xssFilter: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

router.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
}));

/**
 * Middleware to handle rate limiting
 */
const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await rateLimiter.consume(req.ip);
        next();
    } catch (error) {
        logger.warn('Rate limit exceeded', { ip: req.ip });
        res.status(HttpStatus.TOO_MANY_REQUESTS).json({
            status: HttpStatus.TOO_MANY_REQUESTS,
            success: false,
            error: {
                code: ErrorCode.RATE_LIMIT_ERROR,
                message: 'Too many requests, please try again later',
                status: HttpStatus.TOO_MANY_REQUESTS,
                timestamp: new Date()
            }
        });
    }
};

/**
 * Middleware to validate request body
 */
const validateAuthRequest = async (req: Request, res: Response, next: NextFunction) => {
    const correlationId = uuidv4();
    logger.startPerformanceMetric('request-validation');

    try {
        const validationResult = req.path.includes('login') 
            ? await validateLoginRequest(req.body)
            : await validateRegistrationRequest(req.body);

        if (!validationResult.isValid) {
            const validationError: ValidationError = {
                code: ErrorCode.VALIDATION_ERROR,
                message: 'Validation failed',
                status: HttpStatus.BAD_REQUEST,
                timestamp: new Date(),
                validationErrors: validationResult.errors.map(error => ({
                    field: error.field,
                    message: error.message
                }))
            };

            logger.warn('Validation failed', {
                correlationId,
                errors: validationResult.errors
            });

            return res.status(HttpStatus.BAD_REQUEST).json({
                status: HttpStatus.BAD_REQUEST,
                success: false,
                correlationId,
                error: validationError
            });
        }

        logger.endPerformanceMetric('request-validation');
        next();
    } catch (error) {
        logger.error('Validation error', {
            correlationId,
            error,
            code: ErrorCode.VALIDATION_ERROR
        });

        res.status(HttpStatus.BAD_REQUEST).json({
            status: HttpStatus.BAD_REQUEST,
            success: false,
            correlationId,
            error: {
                code: ErrorCode.VALIDATION_ERROR,
                message: 'Request validation failed',
                status: HttpStatus.BAD_REQUEST,
                timestamp: new Date()
            }
        });
    }
};

// Authentication Routes
router.post('/login', rateLimitMiddleware, validateAuthRequest, authController.login);
router.post('/register', validateAuthRequest, authController.register);
router.post('/refresh-token', rateLimitMiddleware, validateAuthRequest, authController.refreshToken);
router.get('/validate', jwtMiddleware, authController.validateToken);
router.post('/mfa/validate', rateLimitMiddleware, validateAuthRequest, authController.validateMFA);

// Error handling middleware
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Route error handler', { error });
    
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: 'An unexpected error occurred',
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            timestamp: new Date()
        }
    });
});

export default router;