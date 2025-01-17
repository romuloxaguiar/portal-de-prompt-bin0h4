/**
 * Enhanced authentication service implementing OAuth 2.0 flow with advanced security features
 * including PKCE, MFA support, token encryption, and comprehensive error handling.
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.4.0
import {
  IAuthUser,
  IAuthTokens,
  IAuthResponse,
  AuthProvider,
  IAuthError,
  IMFAResponse,
  MFAMethod
} from '../interfaces/auth.interface';
import { authConfig } from '../config/auth.config';
import { storage, StorageKeys } from '../utils/storage.util';
import { ErrorCode, ErrorMessage } from '../constants/error.constant';

/**
 * Interface for device fingerprint data
 */
interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
}

/**
 * Enhanced authentication service class with advanced security features
 */
export class AuthService {
  private readonly apiClient: AxiosInstance;
  private tokenRefreshTimeout: NodeJS.Timeout | null = null;
  private readonly maxRetryAttempts = 3;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.apiClient = axios.create({
      baseURL: authConfig.providers.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0'
      }
    });

    this.setupTokenRefreshInterceptor();
    this.initializeService().catch(console.error);
  }

  /**
   * Initializes the authentication service and validates storage
   */
  private async initializeService(): Promise<void> {
    try {
      await storage.initializeStorage();
      await this.validateStoredTokens();
    } catch (error) {
      await this.handleAuthError(error as Error);
    }
  }

  /**
   * Initiates OAuth login flow with PKCE support
   */
  public async login(provider: AuthProvider, enableMFA = false): Promise<void> {
    try {
      const providerConfig = authConfig.providers[provider];
      if (!providerConfig) {
        throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
      }

      // Generate and store PKCE challenge
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      
      // Generate and store state parameter
      const state = this.generateSecureState();
      
      // Store PKCE and state parameters securely
      await storage.setItem(StorageKeys.AUTH_STATE, {
        state,
        codeVerifier,
        provider,
        enableMFA
      }, { encrypt: true, ttl: 600000 }); // 10 minute TTL

      // Generate device fingerprint
      const fingerprint = await this.generateDeviceFingerprint();

      // Construct authorization URL
      const authUrl = new URL(providerConfig.authorizeUrl);
      authUrl.searchParams.append('client_id', providerConfig.clientId);
      authUrl.searchParams.append('redirect_uri', providerConfig.callbackUrl);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', providerConfig.scope.join(' '));
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('device_fingerprint', JSON.stringify(fingerprint));

      window.location.href = authUrl.toString();
    } catch (error) {
      await this.handleAuthError(error as Error);
    }
  }

  /**
   * Handles OAuth callback with enhanced security
   */
  public async handleCallback(code: string, state: string): Promise<IAuthResponse | IMFAResponse> {
    try {
      // Retrieve and validate stored state
      const storedAuth = await storage.getItem<{
        state: string;
        codeVerifier: string;
        provider: AuthProvider;
        enableMFA: boolean;
      }>(StorageKeys.AUTH_STATE);

      if (!storedAuth || storedAuth.state !== state) {
        throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
      }

      const providerConfig = authConfig.providers[storedAuth.provider];
      const fingerprint = await this.generateDeviceFingerprint();

      // Exchange code for tokens
      const response = await this.apiClient.post<IAuthResponse | IMFAResponse>(
        providerConfig.tokenEndpoint,
        {
          grant_type: 'authorization_code',
          code,
          client_id: providerConfig.clientId,
          redirect_uri: providerConfig.callbackUrl,
          code_verifier: storedAuth.codeVerifier,
          device_fingerprint: fingerprint
        }
      );

      // Handle MFA if required
      if (this.isMFAResponse(response.data)) {
        return response.data;
      }

      // Store tokens securely
      await this.handleAuthSuccess(response.data);
      return response.data;
    } catch (error) {
      await this.handleAuthError(error as Error);
      throw error;
    } finally {
      await storage.removeItem(StorageKeys.AUTH_STATE);
    }
  }

  /**
   * Handles MFA challenge verification
   */
  public async handleMFAChallenge(
    challengeId: string,
    code: string,
    method: MFAMethod
  ): Promise<IAuthResponse> {
    try {
      const response = await this.apiClient.post<IAuthResponse>('/auth/mfa/verify', {
        challengeId,
        code,
        method,
        device_fingerprint: await this.generateDeviceFingerprint()
      });

      await this.handleAuthSuccess(response.data);
      return response.data;
    } catch (error) {
      await this.handleAuthError(error as Error);
      throw error;
    }
  }

  /**
   * Refreshes authentication tokens
   */
  public async refreshToken(): Promise<IAuthTokens> {
    try {
      const tokens = await storage.getItem<IAuthTokens>(StorageKeys.AUTH_TOKEN);
      if (!tokens?.refreshToken) {
        throw new Error(ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
      }

      const response = await this.apiClient.post<IAuthTokens>('/auth/refresh', {
        refresh_token: tokens.refreshToken,
        device_fingerprint: await this.generateDeviceFingerprint()
      });

      await storage.setItem(StorageKeys.AUTH_TOKEN, response.data, {
        encrypt: true,
        ttl: response.data.expiresIn * 1000
      });

      return response.data;
    } catch (error) {
      await this.handleAuthError(error as Error);
      throw error;
    }
  }

  /**
   * Configures axios interceptor for token refresh
   */
  private setupTokenRefreshInterceptor(): void {
    this.apiClient.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise(resolve => {
              this.refreshSubscribers.push((token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(this.apiClient(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const tokens = await this.refreshToken();
            this.refreshSubscribers.forEach(callback => callback(tokens.accessToken));
            this.refreshSubscribers = [];
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return this.apiClient(originalRequest);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Generates device fingerprint for additional security
   */
  private async generateDeviceFingerprint(): Promise<DeviceFingerprint> {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform
    };
  }

  /**
   * Generates secure random state parameter
   */
  private generateSecureState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generates PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generates PKCE code challenge
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Type guard for MFA response
   */
  private isMFAResponse(response: IAuthResponse | IMFAResponse): response is IMFAResponse {
    return 'challengeId' in response;
  }

  /**
   * Handles successful authentication
   */
  private async handleAuthSuccess(response: IAuthResponse): Promise<void> {
    await storage.setItem(StorageKeys.AUTH_TOKEN, response.tokens, {
      encrypt: true,
      ttl: response.tokens.expiresIn * 1000
    });

    // Setup token refresh timer
    const refreshTime = (response.tokens.expiresIn - authConfig.tokenConfig.refreshThreshold) * 1000;
    this.tokenRefreshTimeout = setTimeout(() => this.refreshToken(), refreshTime);
  }

  /**
   * Handles authentication errors
   */
  private async handleAuthError(error: Error): Promise<void> {
    await storage.removeItem(StorageKeys.AUTH_TOKEN);
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
    }
    throw new Error(error.message || ErrorMessage[ErrorCode.AUTHENTICATION_ERROR]);
  }

  /**
   * Validates stored tokens on service initialization
   */
  private async validateStoredTokens(): Promise<void> {
    const tokens = await storage.getItem<IAuthTokens>(StorageKeys.AUTH_TOKEN);
    if (tokens) {
      const expirationTime = new Date().getTime() + tokens.expiresIn * 1000;
      if (expirationTime <= new Date().getTime()) {
        await storage.removeItem(StorageKeys.AUTH_TOKEN);
      } else {
        const refreshTime = (tokens.expiresIn - authConfig.tokenConfig.refreshThreshold) * 1000;
        this.tokenRefreshTimeout = setTimeout(() => this.refreshToken(), refreshTime);
      }
    }
  }
}

export default new AuthService();