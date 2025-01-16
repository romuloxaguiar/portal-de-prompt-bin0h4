/**
 * HTTP Status Code Constants
 * 
 * Defines standardized HTTP status codes used throughout the Prompts Portal application
 * for consistent API responses and error handling. Implemented as a TypeScript enum
 * to ensure type safety and immutability.
 * 
 * @enum {number}
 * @version 1.0.0
 */
export enum HttpStatus {
  /**
   * 200 OK
   * Standard response for successful HTTP requests
   */
  OK = 200,

  /**
   * 201 Created
   * Request succeeded and new resource was created
   */
  CREATED = 201,

  /**
   * 202 Accepted
   * Request accepted for processing but not yet completed
   */
  ACCEPTED = 202,

  /**
   * 204 No Content
   * Request processed successfully but no content to return
   */
  NO_CONTENT = 204,

  /**
   * 400 Bad Request
   * Server cannot process request due to client error
   */
  BAD_REQUEST = 400,

  /**
   * 401 Unauthorized
   * Authentication required and has failed or not been provided
   */
  UNAUTHORIZED = 401,

  /**
   * 403 Forbidden
   * Server understood request but refuses to authorize it
   */
  FORBIDDEN = 403,

  /**
   * 404 Not Found
   * Requested resource could not be found
   */
  NOT_FOUND = 404,

  /**
   * 409 Conflict
   * Request conflicts with current state of the server
   */
  CONFLICT = 409,

  /**
   * 422 Unprocessable Entity
   * Request well-formed but unable to process due to semantic errors
   */
  UNPROCESSABLE_ENTITY = 422,

  /**
   * 429 Too Many Requests
   * User has sent too many requests in a given amount of time
   */
  TOO_MANY_REQUESTS = 429,

  /**
   * 500 Internal Server Error
   * Generic server error message for unexpected conditions
   */
  INTERNAL_SERVER_ERROR = 500,

  /**
   * 503 Service Unavailable
   * Server temporarily unable to handle request
   */
  SERVICE_UNAVAILABLE = 503
}