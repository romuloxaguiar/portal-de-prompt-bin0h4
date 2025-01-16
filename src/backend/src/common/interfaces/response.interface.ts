/**
 * @fileoverview Core response interfaces for standardized API and service-level responses
 * across the Prompts Portal application. These interfaces ensure consistent communication
 * patterns and type safety across microservices.
 * 
 * @version 1.0.0
 */

import { HttpStatus } from '../constants/http-status.constant';
import { BaseError } from './error.interface';

/**
 * Base response interface that all API and service responses must implement.
 * Provides core response properties for consistent response handling.
 * 
 * @interface BaseResponse
 */
export interface BaseResponse {
  /**
   * HTTP status code of the response
   */
  status: HttpStatus;

  /**
   * Indicates if the operation was successful
   */
  success: boolean;

  /**
   * Timestamp when response was generated
   */
  timestamp: Date;
}

/**
 * Interface for successful responses with generic data payload.
 * Extends BaseResponse to include success-specific properties.
 * 
 * @interface SuccessResponse
 * @extends {BaseResponse}
 * @template T - Type of the response data payload
 */
export interface SuccessResponse<T> extends BaseResponse {
  /**
   * Generic data payload of the response
   */
  data: T;

  /**
   * Optional success message
   */
  message?: string;
}

/**
 * Interface for error responses containing error details.
 * Extends BaseResponse to include error-specific properties.
 * 
 * @interface ErrorResponse
 * @extends {BaseResponse}
 */
export interface ErrorResponse extends BaseResponse {
  /**
   * Error details including code, message, and status
   */
  error: BaseError;
}

/**
 * Interface for pagination metadata used in paginated responses.
 * Contains information about the current page, total items, and pagination limits.
 * 
 * @interface PaginationMetadata
 */
export interface PaginationMetadata {
  /**
   * Total number of items across all pages
   */
  total: number;

  /**
   * Current page number (1-based)
   */
  page: number;

  /**
   * Number of items per page
   */
  limit: number;

  /**
   * Total number of pages
   */
  totalPages: number;
}

/**
 * Interface for paginated responses with metadata.
 * Extends BaseResponse to include pagination-specific properties.
 * 
 * @interface PaginatedResponse
 * @extends {BaseResponse}
 * @template T - Type of items in the paginated response
 */
export interface PaginatedResponse<T> extends BaseResponse {
  /**
   * Array of paginated items
   */
  data: T[];

  /**
   * Pagination metadata including total, page, limit
   */
  pagination: PaginationMetadata;
}