/**
 * Custom Error Classes and Error Handlers for Attendry Application
 * 
 * This file contains custom error classes and error handling utilities
 * for consistent error management across the application.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ValidationErrorResponse } from './schemas';

/**
 * Base API Error class
 */
export abstract class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    requestId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;
  }

  /**
   * Convert error to JSON response format
   */
  abstract toResponse(): NextResponse;
}

/**
 * Validation Error class
 */
export class ValidationError extends ApiError {
  public readonly errors: Array<{
    field: string;
    message: string;
    value?: any;
    code: string;
  }>;
  public readonly schema: string;

  constructor(
    message: string,
    errors: Array<{
      field: string;
      message: string;
      value?: any;
      code: string;
    }>,
    schema: string,
    requestId?: string
  ) {
    super(message, 400, 'VALIDATION_ERROR', requestId);
    this.errors = errors;
    this.schema = schema;
  }

  toResponse(): NextResponse<ValidationErrorResponse> {
    const response: ValidationErrorResponse = {
      error: this.message,
      code: this.code,
      details: {
        errors: this.errors,
        schema: this.schema,
      },
      timestamp: this.timestamp,
      requestId: this.requestId,
    };

    return NextResponse.json(response, { status: this.statusCode });
  }
}

/**
 * Authentication Error class
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required', requestId?: string) {
    super(message, 401, 'AUTHENTICATION_ERROR', requestId);
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        timestamp: this.timestamp,
        requestId: this.requestId,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Authorization Error class
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions', requestId?: string) {
    super(message, 403, 'AUTHORIZATION_ERROR', requestId);
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        timestamp: this.timestamp,
        requestId: this.requestId,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Not Found Error class
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource', requestId?: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR', requestId);
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        timestamp: this.timestamp,
        requestId: this.requestId,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Conflict Error class
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'Resource conflict', requestId?: string) {
    super(message, 409, 'CONFLICT_ERROR', requestId);
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        timestamp: this.timestamp,
        requestId: this.requestId,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Rate Limit Error class
 */
export class RateLimitError extends ApiError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter?: number,
    requestId?: string
  ) {
    super(message, 429, 'RATE_LIMIT_ERROR', requestId);
    this.retryAfter = retryAfter;
  }

  toResponse(): NextResponse {
    const response: any = {
      error: this.message,
      code: this.code,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };

    if (this.retryAfter) {
      response.retryAfter = this.retryAfter;
    }

    return NextResponse.json(response, { 
      status: this.statusCode,
      headers: this.retryAfter ? {
        'Retry-After': this.retryAfter.toString(),
      } : undefined,
    });
  }
}

/**
 * External Service Error class
 */
export class ExternalServiceError extends ApiError {
  public readonly service: string;
  public readonly originalError?: Error;

  constructor(
    service: string,
    message: string,
    originalError?: Error,
    requestId?: string
  ) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', requestId);
    this.service = service;
    this.originalError = originalError;
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        service: this.service,
        timestamp: this.timestamp,
        requestId: this.requestId,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Database Error class
 */
export class DatabaseError extends ApiError {
  public readonly operation: string;
  public readonly originalError?: Error;

  constructor(
    operation: string,
    message: string,
    originalError?: Error,
    requestId?: string
  ) {
    super(message, 500, 'DATABASE_ERROR', requestId);
    this.operation = operation;
    this.originalError = originalError;
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        operation: this.operation,
        timestamp: this.timestamp,
        requestId: this.requestId,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Internal Server Error class
 */
export class InternalServerError extends ApiError {
  public readonly originalError?: Error;

  constructor(
    message: string = 'Internal server error',
    originalError?: Error,
    requestId?: string
  ) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', requestId);
    this.originalError = originalError;
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        timestamp: this.timestamp,
        requestId: this.requestId,
      },
      { status: this.statusCode }
    );
  }
}

/**
 * Business Logic Error class
 */
export class BusinessLogicError extends ApiError {
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    context?: Record<string, any>,
    requestId?: string
  ) {
    super(message, 422, 'BUSINESS_LOGIC_ERROR', requestId);
    this.context = context;
  }

  toResponse(): NextResponse {
    const response: any = {
      error: this.message,
      code: this.code,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };

    if (this.context) {
      response.context = this.context;
    }

    return NextResponse.json(response, { status: this.statusCode });
  }
}

/**
 * Error handler utility functions
 */

/**
 * Convert Zod error to validation error format
 */
export function formatZodError(error: ZodError): Array<{
  field: string;
  message: string;
  value?: any;
  code: string;
}> {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    value: err.input,
    code: err.code,
  }));
}

/**
 * Generate a unique request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Main error handler for API routes
 * Handles all types of errors and converts them to appropriate HTTP responses
 */
export function handleApiError(
  error: unknown,
  requestId?: string
): NextResponse {
  // If it's already an ApiError, use its toResponse method
  if (error instanceof ApiError) {
    return error.toResponse();
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = new ValidationError(
      'Request validation failed',
      formatZodError(error),
      'unknown_schema',
      requestId
    );
    return validationError.toResponse();
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('not found')) {
      return new NotFoundError('Resource', requestId).toResponse();
    }
    
    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return new AuthenticationError(error.message, requestId).toResponse();
    }
    
    if (error.message.includes('forbidden') || error.message.includes('permission')) {
      return new AuthorizationError(error.message, requestId).toResponse();
    }
    
    if (error.message.includes('conflict')) {
      return new ConflictError(error.message, requestId).toResponse();
    }
    
    if (error.message.includes('rate limit')) {
      return new RateLimitError(error.message, undefined, requestId).toResponse();
    }
    
    if (error.message.includes('database') || error.message.includes('connection')) {
      return new DatabaseError('unknown', error.message, error, requestId).toResponse();
    }
    
    if (error.message.includes('external service') || error.message.includes('API')) {
      return new ExternalServiceError('unknown', error.message, error, requestId).toResponse();
    }

    // Default to internal server error
    return new InternalServerError(error.message, error, requestId).toResponse();
  }

  // Handle unknown error types
  return new InternalServerError(
    'An unexpected error occurred',
    undefined,
    requestId
  ).toResponse();
}

/**
 * Error handler wrapper for async route handlers
 * Catches errors and converts them to appropriate HTTP responses
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse> | NextResponse
) {
  return async (...args: T): Promise<NextResponse> => {
    const requestId = generateRequestId();
    
    try {
      return await handler(...args);
    } catch (error) {
      console.error('Route handler error:', error);
      return handleApiError(error, requestId);
    }
  };
}

/**
 * Type guards for error checking
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isExternalServiceError(error: unknown): error is ExternalServiceError {
  return error instanceof ExternalServiceError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isInternalServerError(error: unknown): error is InternalServerError {
  return error instanceof InternalServerError;
}

export function isBusinessLogicError(error: unknown): error is BusinessLogicError {
  return error instanceof BusinessLogicError;
}

/**
 * Utility function to extract error details for logging
 */
export function extractErrorDetails(error: unknown): {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  context?: any;
} {
  if (error instanceof ApiError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      context: {
        requestId: error.requestId,
        timestamp: error.timestamp,
        ...(error instanceof ValidationError && { errors: error.errors, schema: error.schema }),
        ...(error instanceof ExternalServiceError && { service: error.service }),
        ...(error instanceof DatabaseError && { operation: error.operation }),
        ...(error instanceof BusinessLogicError && { context: error.context }),
        ...(error instanceof RateLimitError && { retryAfter: error.retryAfter }),
      },
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}
