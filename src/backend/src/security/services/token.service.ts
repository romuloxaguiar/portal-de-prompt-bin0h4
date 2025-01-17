import jwt from 'jsonwebtoken'; // v9.0.0
import moment from 'moment'; // v2.29.4
import { IUser } from '../interfaces/user.interface';
import { oauthConfig } from '../config/oauth.config';
import { Logger } from '../../common/utils/logger.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * Service responsible for JWT token operations including generation,
 * validation, refresh, and revocation with comprehensive security features.
 */
export class TokenService {
    private logger: Logger;
    private tokenBlacklist: Set<string>;
    private readonly TOKEN_CLEANUP_INTERVAL = 3600000; // 1 hour

    constructor() {
        this.logger = new Logger('TokenService');
        this.tokenBlacklist = new Set<string>();

        // Setup periodic cleanup of expired blacklisted tokens
        setInterval(() => this.cleanupBlacklist(), this.TOKEN_CLEANUP_INTERVAL);
    }

    /**
     * Generates a secure JWT access token with enhanced payload validation
     * @param user - User object containing authentication details
     * @returns Signed JWT access token
     */
    public generateAccessToken(user: IUser): string {
        try {
            if (!user.id || !user.email || !user.role) {
                throw new Error('Invalid user data for token generation');
            }

            const payload = {
                sub: user.id.toString(),
                email: user.email,
                role: user.role,
                type: 'access',
                fingerprint: this.generateTokenFingerprint(),
                iat: moment().unix(),
                exp: moment().add(
                    oauthConfig.jwtOptions.accessTokenExpiration
                ).unix(),
                iss: oauthConfig.jwtOptions.issuer,
                aud: oauthConfig.jwtOptions.audience
            };

            const token = jwt.sign(
                payload,
                oauthConfig.jwtOptions.secret,
                { algorithm: oauthConfig.jwtOptions.algorithm }
            );

            this.logger.info('Access token generated', {
                userId: user.id,
                tokenType: 'access',
                expiresAt: payload.exp
            });

            return token;
        } catch (error) {
            this.logger.error('Access token generation failed', {
                error,
                userId: user.id,
                code: ErrorCode.AUTHENTICATION_ERROR
            });
            throw error;
        }
    }

    /**
     * Generates a secure refresh token with rotation support
     * @param user - User object containing authentication details
     * @returns Signed JWT refresh token
     */
    public generateRefreshToken(user: IUser): string {
        try {
            const payload = {
                sub: user.id.toString(),
                type: 'refresh',
                rotationCounter: 0,
                fingerprint: this.generateTokenFingerprint(),
                iat: moment().unix(),
                exp: moment().add(
                    oauthConfig.jwtOptions.refreshTokenExpiration
                ).unix(),
                iss: oauthConfig.jwtOptions.issuer,
                aud: oauthConfig.jwtOptions.audience
            };

            const token = jwt.sign(
                payload,
                oauthConfig.jwtOptions.secret,
                { algorithm: oauthConfig.jwtOptions.algorithm }
            );

            this.logger.info('Refresh token generated', {
                userId: user.id,
                tokenType: 'refresh',
                expiresAt: payload.exp
            });

            return token;
        } catch (error) {
            this.logger.error('Refresh token generation failed', {
                error,
                userId: user.id,
                code: ErrorCode.AUTHENTICATION_ERROR
            });
            throw error;
        }
    }

    /**
     * Verifies and decodes a JWT token with enhanced security checks
     * @param token - JWT token to verify
     * @returns Decoded token payload
     */
    public verifyToken(token: string): any {
        try {
            if (this.tokenBlacklist.has(token)) {
                throw new Error('Token has been revoked');
            }

            const decoded = jwt.verify(token, oauthConfig.jwtOptions.secret, {
                algorithms: [oauthConfig.jwtOptions.algorithm],
                issuer: oauthConfig.jwtOptions.issuer,
                audience: oauthConfig.jwtOptions.audience
            });

            if (!decoded || typeof decoded !== 'object') {
                throw new Error('Invalid token structure');
            }

            // Verify token hasn't expired
            if (moment.unix(decoded.exp).isBefore(moment())) {
                throw new Error('Token has expired');
            }

            this.logger.info('Token verified successfully', {
                tokenType: decoded.type,
                userId: decoded.sub
            });

            return decoded;
        } catch (error) {
            this.logger.error('Token verification failed', {
                error,
                code: ErrorCode.AUTHENTICATION_ERROR,
                status: HttpStatus.UNAUTHORIZED
            });
            throw error;
        }
    }

    /**
     * Generates new access token using refresh token with enhanced security
     * @param refreshToken - Valid refresh token
     * @returns New access token
     */
    public refreshAccessToken(refreshToken: string): string {
        try {
            const decoded = this.verifyToken(refreshToken);

            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type for refresh operation');
            }

            if (decoded.rotationCounter >= 100) {
                throw new Error('Maximum token rotation limit reached');
            }

            // Create user object from refresh token data
            const user: IUser = {
                id: decoded.sub,
                email: decoded.email,
                role: decoded.role
            } as IUser;

            // Generate new access token
            const newAccessToken = this.generateAccessToken(user);

            this.logger.info('Access token refreshed', {
                userId: user.id,
                rotationCounter: decoded.rotationCounter
            });

            return newAccessToken;
        } catch (error) {
            this.logger.error('Token refresh failed', {
                error,
                code: ErrorCode.AUTHENTICATION_ERROR
            });
            throw error;
        }
    }

    /**
     * Revokes a token by adding it to the blacklist
     * @param token - Token to revoke
     */
    public revokeToken(token: string): void {
        try {
            const decoded = this.verifyToken(token);
            this.tokenBlacklist.add(token);

            this.logger.info('Token revoked', {
                tokenType: decoded.type,
                userId: decoded.sub,
                expiresAt: decoded.exp
            });
        } catch (error) {
            this.logger.error('Token revocation failed', {
                error,
                code: ErrorCode.AUTHENTICATION_ERROR
            });
            throw error;
        }
    }

    /**
     * Generates a unique token fingerprint for additional security
     * @private
     * @returns Unique token fingerprint
     */
    private generateTokenFingerprint(): string {
        return Buffer.from(
            `${Date.now()}-${Math.random().toString(36)}`
        ).toString('base64');
    }

    /**
     * Cleans up expired tokens from the blacklist
     * @private
     */
    private cleanupBlacklist(): void {
        try {
            const initialSize = this.tokenBlacklist.size;
            const now = moment();

            for (const token of this.tokenBlacklist) {
                try {
                    const decoded = jwt.decode(token);
                    if (decoded && typeof decoded === 'object' && decoded.exp) {
                        if (moment.unix(decoded.exp).isBefore(now)) {
                            this.tokenBlacklist.delete(token);
                        }
                    }
                } catch (error) {
                    // Invalid token in blacklist, remove it
                    this.tokenBlacklist.delete(token);
                }
            }

            this.logger.info('Blacklist cleanup completed', {
                initialSize,
                finalSize: this.tokenBlacklist.size,
                tokensRemoved: initialSize - this.tokenBlacklist.size
            });
        } catch (error) {
            this.logger.error('Blacklist cleanup failed', {
                error,
                code: ErrorCode.INTERNAL_SERVER_ERROR
            });
        }
    }
}