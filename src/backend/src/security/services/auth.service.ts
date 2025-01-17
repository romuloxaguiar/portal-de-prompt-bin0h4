import bcrypt from 'bcrypt'; // v5.1.0
import speakeasy from 'speakeasy'; // v2.0.0
import validator from 'validator'; // v13.9.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1
import { IUser, UserRole, UserStatus } from '../interfaces/user.interface';
import UserModel from '../models/user.model';
import { TokenService } from './token.service';
import { Logger } from '../../common/utils/logger.util';
import { ErrorCode } from '../../common/constants/error-codes.constant';
import { HttpStatus } from '../../common/constants/http-status.constant';

/**
 * Enhanced authentication service implementing OAuth 2.0 flow with advanced security features
 */
export class AuthService {
    private tokenService: TokenService;
    private logger: Logger;
    private rateLimiter: RateLimiterMemory;
    private tokenBlacklist: Map<string, number>;

    constructor() {
        this.tokenService = new TokenService();
        this.logger = new Logger('AuthService');
        this.tokenBlacklist = new Map();

        // Initialize rate limiter with strict limits
        this.rateLimiter = new RateLimiterMemory({
            points: 5, // Number of attempts
            duration: 300, // Per 5 minutes
            blockDuration: 900 // 15 minutes block
        });
    }

    /**
     * Authenticates user with enhanced security checks and MFA support
     */
    public async login(email: string, password: string, mfaToken?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: Partial<IUser>;
    }> {
        try {
            // Rate limiting check
            await this.rateLimiter.consume(email);

            // Validate input
            if (!validator.isEmail(email)) {
                throw new Error('Invalid email format');
            }

            // Find and validate user
            const user = await UserModel.findByEmail(email);
            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Check account status
            if (user.status !== UserStatus.ACTIVE) {
                throw new Error(`Account is ${user.status.toLowerCase()}`);
            }

            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                this.logger.warn('Failed login attempt', { email, code: ErrorCode.AUTHENTICATION_ERROR });
                throw new Error('Invalid credentials');
            }

            // Verify MFA if enabled
            if (user.mfaEnabled) {
                if (!mfaToken) {
                    throw new Error('MFA token required');
                }

                const isMfaValid = speakeasy.totp.verify({
                    secret: user.mfaSecret,
                    encoding: 'base32',
                    token: mfaToken,
                    window: 1
                });

                if (!isMfaValid) {
                    this.logger.warn('Invalid MFA token', { email, code: ErrorCode.AUTHENTICATION_ERROR });
                    throw new Error('Invalid MFA token');
                }
            }

            // Generate tokens
            const accessToken = this.tokenService.generateAccessToken(user);
            const refreshToken = this.tokenService.generateRefreshToken(user);

            // Update last login timestamp
            await UserModel.findByIdAndUpdate(user.id, {
                lastLoginAt: new Date(),
                failedLoginAttempts: 0
            });

            this.logger.info('Successful login', { userId: user.id });

            // Return tokens and filtered user data
            return {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    mfaEnabled: user.mfaEnabled
                }
            };
        } catch (error) {
            this.logger.error('Login failed', {
                error,
                code: ErrorCode.AUTHENTICATION_ERROR,
                status: HttpStatus.UNAUTHORIZED
            });
            throw error;
        }
    }

    /**
     * Registers new user with enhanced validation and security features
     */
    public async register(userData: Partial<IUser>): Promise<Partial<IUser>> {
        try {
            // Validate email
            if (!validator.isEmail(userData.email)) {
                throw new Error('Invalid email format');
            }

            // Check if email exists
            const existingUser = await UserModel.findOne({ email: userData.email });
            if (existingUser) {
                throw new Error('Email already registered');
            }

            // Validate password strength
            if (!validator.isStrongPassword(userData.password, {
                minLength: 12,
                minLowercase: 1,
                minUppercase: 1,
                minNumbers: 1,
                minSymbols: 1
            })) {
                throw new Error('Password does not meet security requirements');
            }

            // Generate MFA secret if required
            const mfaSecret = userData.mfaEnabled ? speakeasy.generateSecret({
                length: 20,
                name: `Prompts Portal:${userData.email}`
            }).base32 : null;

            // Create user with default role and pending status
            const user = new UserModel({
                ...userData,
                role: UserRole.VIEWER,
                status: UserStatus.PENDING,
                mfaSecret,
                failedLoginAttempts: 0,
                lastLoginAt: null,
                passwordLastChangedAt: new Date()
            });

            await user.save();

            this.logger.info('User registered successfully', { userId: user.id });

            // Return filtered user data
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                status: user.status,
                firstName: user.firstName,
                lastName: user.lastName,
                mfaEnabled: user.mfaEnabled
            };
        } catch (error) {
            this.logger.error('Registration failed', {
                error,
                code: ErrorCode.VALIDATION_ERROR,
                status: HttpStatus.BAD_REQUEST
            });
            throw error;
        }
    }

    /**
     * Refreshes access token with enhanced security checks
     */
    public async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
        try {
            // Verify token is not blacklisted
            if (this.tokenBlacklist.has(refreshToken)) {
                throw new Error('Token has been revoked');
            }

            // Verify refresh token
            const decoded = await this.tokenService.verifyToken(refreshToken);
            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            // Get user and verify status
            const user = await UserModel.findById(decoded.sub);
            if (!user || user.status !== UserStatus.ACTIVE) {
                throw new Error('Invalid token');
            }

            // Generate new access token
            const accessToken = this.tokenService.generateAccessToken(user);

            this.logger.info('Token refreshed successfully', { userId: user.id });

            return { accessToken };
        } catch (error) {
            this.logger.error('Token refresh failed', {
                error,
                code: ErrorCode.AUTHENTICATION_ERROR,
                status: HttpStatus.UNAUTHORIZED
            });
            throw error;
        }
    }

    /**
     * Validates token with enhanced security checks
     */
    public async validateToken(token: string): Promise<any> {
        try {
            // Check token blacklist
            if (this.tokenBlacklist.has(token)) {
                throw new Error('Token has been revoked');
            }

            // Verify token
            const decoded = await this.tokenService.verifyToken(token);

            // Verify user still exists and is active
            const user = await UserModel.findById(decoded.sub);
            if (!user || user.status !== UserStatus.ACTIVE) {
                throw new Error('Invalid token');
            }

            this.logger.info('Token validated successfully', { userId: user.id });

            return decoded;
        } catch (error) {
            this.logger.error('Token validation failed', {
                error,
                code: ErrorCode.AUTHENTICATION_ERROR,
                status: HttpStatus.UNAUTHORIZED
            });
            throw error;
        }
    }
}