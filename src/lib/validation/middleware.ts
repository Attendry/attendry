/**
 * Validation Middleware for Attendry Application
 * 
 * This file contains middleware functions for validating API requests
 * using Zod schemas, providing consistent error handling and type safety.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { ValidationErrorResponse } from './schemas';

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';
  public readonly statusCode = 400;
  public readonly errors: Array<{
    field: string;
    message: string;
    value?: any;
    code: string;
  }>;

  constructor(
    message: string,
    errors: Array<{
      field: string;
      message: string;
      value?: any;
      code: string;
    }>,
    schema: string
  ) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.schema = schema;
  }

  public readonly schema: string;
}

/**
 * Convert Zod error to validation error format
 */
function formatZodError(error: ZodError): Array<{
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
 * Create validation error response
 */
function createValidationErrorResponse(
  error: ValidationError,
  requestId?: string
): NextResponse<ValidationErrorResponse> {
  const response: ValidationErrorResponse = {
    error: error.message,
    code: 'VALIDATION_ERROR',
    details: {
      errors: error.errors,
      schema: error.schema,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  return NextResponse.json(response, { status: error.statusCode });
}

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validation middleware factory
 * Creates a middleware function that validates request data against a Zod schema
 */
export function createValidationMiddleware<T>(
  schema: ZodSchema<T>,
  schemaName: string,
  options: {
    validateBody?: boolean;
    validateQuery?: boolean;
    validateParams?: boolean;
    customValidator?: (data: any) => Promise<T> | T;
  } = {}
) {
  const {
    validateBody = true,
    validateQuery = false,
    validateParams = false,
    customValidator,
  } = options;

  return function validationMiddleware(
    handler: (req: NextRequest, validatedData: T) => Promise<NextResponse> | NextResponse
  ) {
    return async function validatedHandler(req: NextRequest): Promise<NextResponse> {
      const requestId = generateRequestId();
      
      try {
        let dataToValidate: any = {};

        // Validate request body
        if (validateBody) {
          try {
            const body = await req.json();
            dataToValidate = { ...dataToValidate, ...body };
          } catch (error) {
            throw new ValidationError(
              'Invalid JSON in request body',
              [{
                field: 'body',
                message: 'Request body must be valid JSON',
                code: 'invalid_json',
              }],
              schemaName
            );
          }
        }

        // Validate query parameters
        if (validateQuery) {
          const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
          dataToValidate = { ...dataToValidate, ...queryParams };
        }

        // Validate route parameters
        if (validateParams) {
          // Note: Next.js doesn't provide route params in middleware
          // This would need to be handled at the route level
          console.warn('Route parameter validation not implemented in middleware');
        }

        // Apply custom validator if provided
        if (customValidator) {
          dataToValidate = await customValidator(dataToValidate);
        }

        // Validate data against schema
        const validatedData = schema.parse(dataToValidate);

        // Call the original handler with validated data
        return await handler(req, validatedData);
      } catch (error) {
        if (error instanceof ValidationError) {
          return createValidationErrorResponse(error, requestId);
        }

        if (error instanceof ZodError) {
          const validationError = new ValidationError(
            'Request validation failed',
            formatZodError(error),
            schemaName
          );
          return createValidationErrorResponse(validationError, requestId);
        }

        // Handle unexpected errors
        console.error('Validation middleware error:', error);
        return NextResponse.json(
          {
            error: 'Internal validation error',
            code: 'INTERNAL_ERROR',
            timestamp: new Date().toISOString(),
            requestId,
          },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Simple validation function for use in route handlers
 * Returns validated data or throws ValidationError
 */
export function validateRequest<T>(
  data: any,
  schema: ZodSchema<T>,
  schemaName: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        'Request validation failed',
        formatZodError(error),
        schemaName
      );
    }
    throw error;
  }
}

/**
 * Async validation function for use in route handlers
 * Returns validated data or throws ValidationError
 */
export async function validateRequestAsync<T>(
  data: any,
  schema: ZodSchema<T>,
  schemaName: string,
  customValidator?: (data: any) => Promise<T> | T
): Promise<T> {
  try {
    let dataToValidate = data;
    
    if (customValidator) {
      dataToValidate = await customValidator(data);
    }
    
    return schema.parse(dataToValidate);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    
    if (error instanceof ZodError) {
      throw new ValidationError(
        'Request validation failed',
        formatZodError(error),
        schemaName
      );
    }
    throw error;
  }
}

/**
 * Error handler for validation errors
 * Converts ValidationError to proper HTTP response
 */
export function handleValidationError(
  error: ValidationError,
  requestId?: string
): NextResponse<ValidationErrorResponse> {
  return createValidationErrorResponse(error, requestId);
}

/**
 * Generic error handler for API routes
 * Handles both validation errors and other errors
 */
export function handleApiError(
  error: unknown,
  requestId?: string
): NextResponse {
  if (error instanceof ValidationError) {
    return handleValidationError(error, requestId);
  }

  // Handle other types of errors
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  const statusCode = error instanceof Error && 'statusCode' in error 
    ? (error as any).statusCode 
    : 500;

  return NextResponse.json(
    {
      error: message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId,
    },
    { status: statusCode }
  );
}

/**
 * Utility function to safely parse JSON from request
 */
export async function safeJsonParse(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch (error) {
    throw new ValidationError(
      'Invalid JSON in request body',
      [{
        field: 'body',
        message: 'Request body must be valid JSON',
        code: 'invalid_json',
      }],
      'json_parse'
    );
  }
}

/**
 * Utility function to validate and transform query parameters
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>,
  schemaName: string
): T {
  const queryData = Object.fromEntries(searchParams.entries());
  return validateRequest(queryData, schema, schemaName);
}

/**
 * Utility function to create a validated route handler
 * Combines validation and error handling in one function
 */
export function createValidatedRouteHandler<T>(
  schema: ZodSchema<T>,
  schemaName: string,
  handler: (req: NextRequest, validatedData: T) => Promise<NextResponse> | NextResponse,
  options: {
    validateBody?: boolean;
    validateQuery?: boolean;
    customValidator?: (data: any) => Promise<T> | T;
  } = {}
) {
  const middleware = createValidationMiddleware(schema, schemaName, options);
  return middleware(handler);
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

/**
 * Extract validation errors from any error
 */
export function extractValidationErrors(error: unknown): Array<{
  field: string;
  message: string;
  value?: any;
  code: string;
}> {
  if (error instanceof ValidationError) {
    return error.errors;
  }
  
  if (error instanceof ZodError) {
    return formatZodError(error);
  }
  
  return [{
    field: 'unknown',
    message: error instanceof Error ? error.message : 'Unknown error',
    code: 'unknown_error',
  }];
}
