/**
 * @fileoverview Type definitions for standardized API responses used throughout the Prompts Portal application.
 * Provides type-safe response structures that ensure consistent API communication patterns across all microservices.
 * Supports monitoring, metrics collection, and error tracking capabilities.
 * 
 * @version 1.0.0
 */

import { HttpStatus } from '../constants/http-status.constant';
import { BaseResponse, SuccessResponse, ErrorResponse, PaginatedResponse } from '../interfaces/response.interface';
import { BaseError } from '../interfaces/error.interface';

/**
 * Union type representing all possible API response types.
 * Combines success and error response interfaces for comprehensive type coverage.
 * 
 * @template T - Type of data payload in success response
 * 
 * Usage example:
 * ```typescript
 * type UserResponse = ApiResponse<User>;
 * type PromptResponse = ApiResponse<Prompt>;
 * ```
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Union type representing paginated API response types.
 * Combines paginated success and error response interfaces for list endpoints.
 * 
 * @template T - Type of items in paginated data array
 * 
 * Usage example:
 * ```typescript
 * type PaginatedPromptsResponse = ApiPaginatedResponse<Prompt>;
 * type PaginatedWorkspacesResponse = ApiPaginatedResponse<Workspace>;
 * ```
 */
export type ApiPaginatedResponse<T> = PaginatedResponse<T> | ErrorResponse;