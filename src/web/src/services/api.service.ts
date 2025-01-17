/**
 * Core API service for handling HTTP communications in the Prompts Portal frontend.
 * Implements enterprise-grade request/response handling, error management, and retry logic.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import { appConfig } from '../config/app.config';
import { API_ENDPOINTS, API_METHODS, getEndpointUrl, isValidEndpoint, isValidMethod } from '../constants/api.constant';
import { handleError, createError } from '../utils/error.util';
import { ErrorCode } from '../constants/error.constant';

// Default request configuration
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Client-Version': process.env.VITE_APP_VERSION || '1.0.0',
};

const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CACHE_DURATION = 300000; // 5 minutes

/**
 * Configuration interface for API requests
 */
interface ApiRequestConfig extends Omit<AxiosRequestConfig, 'url' | 'method'> {
  url: string;
  method: API_METHODS;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  priority?: number;
  cache?: boolean;
  retryAttempts?: number;
}

/**
 * Generic interface for API responses
 */
interface ApiResponse<T = any> {
  data: T;
  status: number;
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
  requestId: string;
}

/**
 * Cache implementation for API responses
 */
class ResponseCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Circuit breaker implementation for API requests
 */
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private isOpen: boolean = false;

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.isOpen = true;
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
  }

  canRequest(): boolean {
    if (!this.isOpen) return true;
    const cooldownPeriod = 60000; // 1 minute
    if (Date.now() - this.lastFailureTime > cooldownPeriod) {
      this.isOpen = false;
      this.failures = 0;
      return true;
    }
    return false;
  }
}

/**
 * Core API service class
 */
class ApiService {
  private axiosInstance: AxiosInstance;
  private cache: ResponseCache;
  private circuitBreaker: CircuitBreaker;
  private pendingRequests: Map<string, Promise<any>>;

  constructor() {
    this.axiosInstance = this.createApiInstance();
    this.cache = new ResponseCache();
    this.circuitBreaker = new CircuitBreaker();
    this.pendingRequests = new Map();
  }

  /**
   * Creates and configures axios instance with interceptors
   */
  private createApiInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: appConfig.api.baseUrl,
      timeout: appConfig.api.timeout,
      headers: DEFAULT_HEADERS
    });

    // Request interceptor
    instance.interceptors.request.use(
      (config) => {
        config.headers['X-Request-ID'] = this.generateRequestId();
        return config;
      },
      (error) => Promise.reject(handleError(error))
    );

    // Response interceptor
    instance.interceptors.response.use(
      (response) => {
        this.circuitBreaker.recordSuccess();
        return response;
      },
      (error) => {
        this.circuitBreaker.recordFailure();
        return Promise.reject(handleError(error));
      }
    );

    return instance;
  }

  /**
   * Makes an HTTP request with comprehensive error handling and performance features
   */
  async request<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    if (!isValidEndpoint(config.url)) {
      throw createError(ErrorCode.VALIDATION_ERROR, { message: 'Invalid endpoint' });
    }

    if (!isValidMethod(config.method)) {
      throw createError(ErrorCode.VALIDATION_ERROR, { message: 'Invalid HTTP method' });
    }

    if (!this.circuitBreaker.canRequest()) {
      throw createError(ErrorCode.NETWORK_ERROR, { message: 'Circuit breaker is open' });
    }

    const cacheKey = this.generateCacheKey(config);
    if (config.cache && config.method === API_METHODS.GET) {
      const cachedResponse = this.cache.get(cacheKey);
      if (cachedResponse) return cachedResponse;
    }

    const requestKey = this.generateRequestId();
    try {
      const existingRequest = this.pendingRequests.get(cacheKey);
      if (existingRequest) return existingRequest;

      const request = this.executeRequest<T>(config, requestKey);
      this.pendingRequests.set(cacheKey, request);

      const response = await request;
      if (config.cache && config.method === API_METHODS.GET) {
        this.cache.set(cacheKey, response);
      }

      return response;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Executes the actual HTTP request with retry logic
   */
  private async executeRequest<T>(
    config: ApiRequestConfig,
    requestId: string,
    attempt: number = 1
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.request({
        ...config,
        headers: {
          ...config.headers,
          'X-Request-ID': requestId
        }
      });

      return this.transformResponse<T>(response);
    } catch (error) {
      if (attempt < (config.retryAttempts || MAX_RETRIES)) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeRequest<T>(config, requestId, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Transforms axios response to standardized API response
   */
  private transformResponse<T>(response: AxiosResponse): ApiResponse<T> {
    return {
      data: response.data,
      status: response.status,
      message: response.statusText,
      metadata: response.headers,
      timestamp: Date.now(),
      requestId: response.config.headers['X-Request-ID']
    };
  }

  /**
   * Generates unique request identifier
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates cache key for request
   */
  private generateCacheKey(config: ApiRequestConfig): string {
    return `${config.method}-${config.url}-${JSON.stringify(config.params)}-${JSON.stringify(config.data)}`;
  }

  // Convenience methods for common HTTP methods
  async get<T = any>(url: string, config?: Omit<ApiRequestConfig, 'url' | 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: API_METHODS.GET });
  }

  async post<T = any>(url: string, data?: any, config?: Omit<ApiRequestConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: API_METHODS.POST, data });
  }

  async put<T = any>(url: string, data?: any, config?: Omit<ApiRequestConfig, 'url' | 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: API_METHODS.PUT, data });
  }

  async delete<T = any>(url: string, config?: Omit<ApiRequestConfig, 'url' | 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, url, method: API_METHODS.DELETE });
  }
}

// Export singleton instance
export const apiService = new ApiService();