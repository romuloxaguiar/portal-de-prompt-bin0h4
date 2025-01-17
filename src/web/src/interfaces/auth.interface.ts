/**
 * Authentication interfaces and types for the Prompts Portal frontend application.
 * Implements OAuth 2.0 flow with multi-factor authentication support and strict type safety.
 * @version 1.0.0
 */

/**
 * Supported OAuth authentication providers
 */
export enum AuthProvider {
    GOOGLE = 'GOOGLE',
    GITHUB = 'GITHUB',
    MICROSOFT = 'MICROSOFT'
}

/**
 * Supported multi-factor authentication methods
 */
export enum MFAMethod {
    TOTP = 'TOTP',
    SMS = 'SMS',
    EMAIL = 'EMAIL'
}

/**
 * Interface for authenticated user data with strict null safety
 */
export interface IAuthUser {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly provider: AuthProvider;
    readonly avatarUrl: string | null;
    readonly providerMetadata: Record<string, unknown>;
}

/**
 * Interface for authentication tokens with security metadata
 */
export interface IAuthTokens {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresIn: number;
    readonly tokenType: string;
    readonly scope: string;
}

/**
 * Interface for multi-factor authentication status
 */
export interface IMFAStatus {
    readonly required: boolean;
    readonly verified: boolean;
    readonly method: MFAMethod;
}

/**
 * Interface for authentication response including user data, tokens, and MFA status
 */
export interface IAuthResponse {
    readonly user: IAuthUser;
    readonly tokens: IAuthTokens;
    readonly mfa: IMFAStatus;
}

/**
 * Interface for authentication state management with loading and error states
 */
export interface IAuthState {
    readonly isAuthenticated: boolean;
    readonly user: IAuthUser | null;
    readonly accessToken: string | null;
    readonly loading: boolean;
    readonly error: IAuthError | null;
}

/**
 * Interface for authentication error handling with detailed error information
 */
export interface IAuthError {
    readonly code: string;
    readonly message: string;
    readonly details: Record<string, unknown>;
}