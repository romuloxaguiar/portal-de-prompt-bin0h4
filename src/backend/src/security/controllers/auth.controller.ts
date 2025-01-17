import { Request, Response } from 'express'; // v4.18.2
import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { AuthService } from '../services/auth.service';
import { BaseResponse } from '../../common/interfaces/response.interface';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { Logger } from '../../common/utils/logger.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * Enhanced authentication controller implementing OAuth 2.0 flow with comprehensive
 * security features including MFA, rate limiting, and audit logging.
 */
export class AuthController {
    private readonly logger: Logger;
    private readonly rateLimiter: RateLimiterMemory;

    constructor(
        private readonly authService: AuthService
    ) {
        this.logger = new Logger('AuthController');
        
        // Initialize rate limiter with strict limits
        this.rateLimiter = new RateLimiterMemory({
            points: 5, // Number of attempts
            duration: 300, // Per 5 minutes
            blockDuration: 900 // 15 minutes block
        });
    }

    /**
     * Handles user login with enhanced security measures
     * @param req Express request object
     * @param res Express response object
     */
    public async login(req: Request, res: Response): Promise<Response> {
        const correlationId = uuidv4();
        
        try {
            // Rate limiting check
            await this.rateLimiter.consume(req.ip);

            // Validate request body
            const { email, password, mfaToken } = req.body;
            if (!email || !password) {
                throw new Error('Missing required credentials');
            }

            // Log login attempt with security context
            this.logger.info('Login attempt', {
                correlationId,
                email,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            // Process login
            const result = await this.authService.login(email, password, mfaToken);

            // Log successful login
            this.logger.info('Login successful', {
                correlationId,
                userId: result.user.id,
                email: result.user.email
            });

            // Return success response with tokens
            return res.status(HttpStatus.OK).json({
                status: HttpStatus.OK,
                success: true,
                correlationId,
                timestamp: new Date(),
                data: result
            });

        } catch (error) {
            // Log error with security context
            this.logger.error('Login failed', {
                correlationId,
                error,
                code: ErrorCode.AUTHENTICATION_ERROR,
                ip: req.ip
            });

            // Return error response
            return res.status(HttpStatus.UNAUTHORIZED).json({
                status: HttpStatus.UNAUTHORIZED,
                success: false,
                correlationId,
                timestamp: new Date(),
                error: {
                    code: ErrorCode.AUTHENTICATION_ERROR,
                    message: 'Authentication failed',
                    status: HttpStatus.UNAUTHORIZED
                }
            });
        }
    }

    /**
     * Handles user registration with enhanced validation
     * @param req Express request object
     * @param res Express response object
     */
    public async register(req: Request, res: Response): Promise<Response> {
        const correlationId = uuidv4();

        try {
            // Validate request body
            const { email, password, firstName, lastName, mfaEnabled } = req.body;
            if (!email || !password || !firstName || !lastName) {
                throw new Error('Missing required fields');
            }

            // Log registration attempt
            this.logger.info('Registration attempt', {
                correlationId,
                email,
                ip: req.ip
            });

            // Process registration
            const user = await this.authService.register({
                email,
                password,
                firstName,
                lastName,
                mfaEnabled: !!mfaEnabled
            });

            // Log successful registration
            this.logger.info('Registration successful', {
                correlationId,
                userId: user.id,
                email: user.email
            });

            return res.status(HttpStatus.CREATED).json({
                status: HttpStatus.CREATED,
                success: true,
                correlationId,
                timestamp: new Date(),
                data: user
            });

        } catch (error) {
            this.logger.error('Registration failed', {
                correlationId,
                error,
                code: ErrorCode.VALIDATION_ERROR,
                ip: req.ip
            });

            return res.status(HttpStatus.BAD_REQUEST).json({
                status: HttpStatus.BAD_REQUEST,
                success: false,
                correlationId,
                timestamp: new Date(),
                error: {
                    code: ErrorCode.VALIDATION_ERROR,
                    message: 'Registration failed',
                    status: HttpStatus.BAD_REQUEST
                }
            });
        }
    }

    /**
     * Handles token refresh with security validation
     * @param req Express request object
     * @param res Express response object
     */
    public async refreshToken(req: Request, res: Response): Promise<Response> {
        const correlationId = uuidv4();

        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                throw new Error('Refresh token required');
            }

            const result = await this.authService.refreshToken(refreshToken);

            this.logger.info('Token refresh successful', {
                correlationId,
                tokenType: 'access'
            });

            return res.status(HttpStatus.OK).json({
                status: HttpStatus.OK,
                success: true,
                correlationId,
                timestamp: new Date(),
                data: result
            });

        } catch (error) {
            this.logger.error('Token refresh failed', {
                correlationId,
                error,
                code: ErrorCode.AUTHENTICATION_ERROR
            });

            return res.status(HttpStatus.UNAUTHORIZED).json({
                status: HttpStatus.UNAUTHORIZED,
                success: false,
                correlationId,
                timestamp: new Date(),
                error: {
                    code: ErrorCode.AUTHENTICATION_ERROR,
                    message: 'Token refresh failed',
                    status: HttpStatus.UNAUTHORIZED
                }
            });
        }
    }

    /**
     * Validates token with enhanced security checks
     * @param req Express request object
     * @param res Express response object
     */
    public async validateToken(req: Request, res: Response): Promise<Response> {
        const correlationId = uuidv4();

        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) {
                throw new Error('Token required');
            }

            const decoded = await this.authService.validateToken(token);

            this.logger.info('Token validation successful', {
                correlationId,
                userId: decoded.sub
            });

            return res.status(HttpStatus.OK).json({
                status: HttpStatus.OK,
                success: true,
                correlationId,
                timestamp: new Date(),
                data: decoded
            });

        } catch (error) {
            this.logger.error('Token validation failed', {
                correlationId,
                error,
                code: ErrorCode.AUTHENTICATION_ERROR
            });

            return res.status(HttpStatus.UNAUTHORIZED).json({
                status: HttpStatus.UNAUTHORIZED,
                success: false,
                correlationId,
                timestamp: new Date(),
                error: {
                    code: ErrorCode.AUTHENTICATION_ERROR,
                    message: 'Token validation failed',
                    status: HttpStatus.UNAUTHORIZED
                }
            });
        }
    }
}