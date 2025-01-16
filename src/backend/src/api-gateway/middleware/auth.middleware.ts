import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { Logger } from '../../common/utils/logger.util'; // v3.10.0
import { TokenService } from '../../security/services/token.service';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0

/**
 * Authentication middleware class that handles JWT token validation,
 * request authentication, and security monitoring for the API Gateway
 */
export class AuthMiddleware {
    private readonly TOKEN_HEADER = 'Authorization';
    private readonly TOKEN_PREFIX = 'Bearer ';
    private readonly logger: Logger;
    private readonly tokenService: TokenService;
    private readonly rateLimiter: any;

    constructor() {
        this.logger = new Logger('AuthMiddleware');
        this.tokenService = new TokenService();
        
        // Configure rate limiting
        this.rateLimiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per window
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req: Request, res: Response) => {
                this.logger.warn('Rate limit exceeded', {
                    ip: req.ip,
                    path: req.path,
                    code: ErrorCode.RATE_LIMIT_ERROR
                });
                res.status(HttpStatus.TOO_MANY_REQUESTS).json({
                    code: ErrorCode.RATE_LIMIT_ERROR,
                    message: 'Too many requests, please try again later'
                });
            }
        });
    }

    /**
     * Express middleware function that authenticates requests using JWT tokens
     */
    public authenticate = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const requestId = uuidv4();
        const startTime = process.hrtime();

        try {
            // Extract token from Authorization header
            const authHeader = req.header(this.TOKEN_HEADER);
            if (!authHeader?.startsWith(this.TOKEN_PREFIX)) {
                throw new Error('Missing or invalid Authorization header');
            }

            const token = authHeader.substring(this.TOKEN_PREFIX.length);

            // Verify token and extract payload
            const decodedToken = await this.tokenService.verifyToken(token);

            // Generate security context
            const securityContext = {
                requestId,
                timestamp: new Date(),
                correlationId: req.header('X-Correlation-ID') || requestId,
                userAgent: req.header('User-Agent'),
                ip: req.ip,
                method: req.method,
                path: req.path
            };

            // Enrich request with user context
            (req as AuthenticatedRequest).userId = decodedToken.sub;
            (req as AuthenticatedRequest).workspaceId = decodedToken.workspaceId;
            (req as AuthenticatedRequest).roles = decodedToken.roles;
            (req as AuthenticatedRequest).permissions = decodedToken.permissions;
            (req as AuthenticatedRequest).securityContext = securityContext;

            // Log successful authentication
            const duration = process.hrtime(startTime);
            this.logger.info('Request authenticated', {
                ...securityContext,
                duration: `${duration[0]}s ${duration[1] / 1000000}ms`,
                userId: decodedToken.sub
            });

            next();
        } catch (error) {
            // Log authentication failure
            const duration = process.hrtime(startTime);
            this.logger.error('Authentication failed', {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
                path: req.path,
                method: req.method,
                ip: req.ip,
                duration: `${duration[0]}s ${duration[1] / 1000000}ms`,
                code: ErrorCode.AUTHENTICATION_ERROR
            });

            // Return appropriate error response
            res.status(HttpStatus.UNAUTHORIZED).json({
                code: ErrorCode.AUTHENTICATION_ERROR,
                message: 'Authentication failed',
                requestId
            });
        }
    };

    /**
     * Express middleware function that applies rate limiting
     */
    public applyRateLimit = (): any => {
        return this.rateLimiter;
    };

    /**
     * Validates token format and structure
     */
    private validateTokenFormat(token: string): boolean {
        if (!token || token.trim().length === 0) {
            throw new Error('Empty token provided');
        }

        // Basic JWT format validation (header.payload.signature)
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }

        return true;
    }

    /**
     * Generates request fingerprint for security tracking
     */
    private generateRequestFingerprint(req: Request): string {
        const components = [
            req.ip,
            req.header('User-Agent') || 'unknown',
            req.method,
            req.path,
            new Date().toISOString()
        ];
        return Buffer.from(components.join('|')).toString('base64');
    }
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();