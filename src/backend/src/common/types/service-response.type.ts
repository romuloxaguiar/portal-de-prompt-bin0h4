/**
 * @fileoverview Type definitions for standardized service-level responses used across
 * microservices in the Prompts Portal application. These types ensure consistent
 * response structures for inter-service communication and error handling.
 * 
 * @version 1.0.0
 */

import { HttpStatus } from '../constants/http-status.constant';
import { BaseError } from '../interfaces/error.interface';

/**
 * Metadata interface for paginated responses with readonly properties
 * to ensure immutability of pagination information
 */
interface PaginationMetadata {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

/**
 * Type definition for successful service responses with type safety constraint
 * requiring data payload to be an object type
 * 
 * @template T - Generic type extending object for type-safe data payload
 */
export type ServiceSuccessResponse<T extends object> = {
  readonly success: true;
  readonly data: T;
};

/**
 * Type definition for service error responses with detailed error information
 * using the standardized BaseError interface
 */
export type ServiceErrorResponse = {
  readonly success: false;
  readonly error: BaseError;
};

/**
 * Generic union type for all possible service responses with type safety constraint
 * Combines success and error response types into a discriminated union
 * 
 * @template T - Generic type extending object for type-safe data payload
 */
export type ServiceResponse<T extends object> = 
  | ServiceSuccessResponse<T>
  | ServiceErrorResponse;

/**
 * Type definition for paginated service responses with immutable data array
 * and pagination metadata
 * 
 * @template T - Generic type extending object for type-safe data items
 */
export type ServicePaginatedResponse<T extends object> = {
  readonly success: true;
  readonly data: readonly T[];
  readonly pagination: PaginationMetadata;
};

/**
 * Type guard to check if a response is a successful response
 * 
 * @param response - Service response to check
 * @returns Type predicate indicating if response is successful
 */
export const isSuccessResponse = <T extends object>(
  response: ServiceResponse<T>
): response is ServiceSuccessResponse<T> => response.success;

/**
 * Type guard to check if a response is a paginated response
 * 
 * @param response - Service response to check
 * @returns Type predicate indicating if response is paginated
 */
export const isPaginatedResponse = <T extends object>(
  response: ServiceResponse<T> | ServicePaginatedResponse<T>
): response is ServicePaginatedResponse<T> => {
  return response.success && 'pagination' in response;
};