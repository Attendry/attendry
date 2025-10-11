/**
 * Enhanced Error Handler Middleware
 * 
 * Provides comprehensive error handling, logging, and monitoring
 * for API routes with graceful degradation and user-friendly responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { integrationHealthMonitor } from '@/lib/services/integration-health-monitor';
import { RetryService } from '@/lib/services/retry-service';
import { getAllCircuitBreakerStats } from '@/lib/services/circuit-breaker';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  service?: string;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
  url?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  requestId?: string;
  timestamp: string;
  details?: Record<string, any>;
  suggestions?: string[];
}

export class EnhancedErrorHandler {
  /**
   * Handle errors with comprehensive logging and monitoring
   */
  static async handleError(
    error: unknown,
    context: ErrorContext,
    request?: NextRequest
  ): Promise<NextResponse<ErrorResponse>> {
    const errorInfo = this.analyzeError(error, context);
    
    // Log error with context
    this.logError(error, errorInfo, context);
    
    // Update monitoring metrics
    await this.updateMonitoringMetrics(errorInfo, context);
    
    // Generate user-friendly response
    const response = this.generateErrorResponse(errorInfo, context);
    
    return NextResponse.json(response, { 
      status: errorInfo.statusCode,
      headers: {
        'X-Request-ID': context.requestId || 'unknown',
        'X-Error-Code': errorInfo.code,
        'X-Error-Type': errorInfo.type
      }
    });
  }

  /**
   * Analyze error and extract relevant information
   */
  private static analyzeError(error: unknown, context: ErrorContext) {
    const timestamp = new Date();
    
    if (error instanceof Error) {
      return {
        type: 'Error',
        message: error.message,
        name: error.name,
        stack: error.stack,
        statusCode: this.getStatusCodeFromError(error),
        code: this.getErrorCode(error),
        severity: this.getSeverity(error),
        isRetryable: this.isRetryableError(error),
        timestamp
      };
    }
    
    if (typeof error === 'string') {
      return {
        type: 'String',
        message: error,
        name: 'StringError',
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        severity: 'high',
        isRetryable: false,
        timestamp
      };
    }
    
    return {
      type: 'Unknown',
      message: 'An unknown error occurred',
      name: 'UnknownError',
      statusCode: 500,
      code: 'UNKNOWN_ERROR',
      severity: 'high',
      isRetryable: false,
      timestamp
    };
  }

  /**
   * Get HTTP status code from error
   */
  private static getStatusCodeFromError(error: Error): number {
    // Check for specific error types
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'UnauthorizedError') return 401;
    if (error.name === 'ForbiddenError') return 403;
    if (error.name === 'NotFoundError') return 404;
    if (error.name === 'ConflictError') return 409;
    if (error.name === 'RateLimitError') return 429;
    
    // Check for network/API errors
    if (error.message.includes('ECONNREFUSED')) return 503;
    if (error.message.includes('ETIMEDOUT')) return 504;
    if (error.message.includes('ENOTFOUND')) return 503;
    
    // Check for HTTP status codes in message
    const statusMatch = error.message.match(/HTTP (\d{3})/);
    if (statusMatch) {
      return parseInt(statusMatch[1]);
    }
    
    return 500;
  }

  /**
   * Get error code for categorization
   */
  private static getErrorCode(error: Error): string {
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'UnauthorizedError') return 'UNAUTHORIZED';
    if (error.name === 'ForbiddenError') return 'FORBIDDEN';
    if (error.name === 'NotFoundError') return 'NOT_FOUND';
    if (error.name === 'ConflictError') return 'CONFLICT';
    if (error.name === 'RateLimitError') return 'RATE_LIMITED';
    
    // Network/API errors
    if (error.message.includes('ECONNREFUSED')) return 'SERVICE_UNAVAILABLE';
    if (error.message.includes('ETIMEDOUT')) return 'TIMEOUT';
    if (error.message.includes('ENOTFOUND')) return 'SERVICE_NOT_FOUND';
    
    // External service errors
    if (error.message.includes('Firecrawl')) return 'FIRECRAWL_ERROR';
    if (error.message.includes('Google CSE')) return 'GOOGLE_CSE_ERROR';
    if (error.message.includes('Gemini')) return 'GEMINI_ERROR';
    if (error.message.includes('Supabase')) return 'SUPABASE_ERROR';
    
    return 'INTERNAL_ERROR';
  }

  /**
   * Get error severity level
   */
  private static getSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error.name === 'ValidationError') return 'low';
    if (error.name === 'NotFoundError') return 'low';
    if (error.name === 'UnauthorizedError') return 'medium';
    if (error.name === 'ForbiddenError') return 'medium';
    if (error.name === 'RateLimitError') return 'medium';
    
    // Network/API errors are high severity
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ETIMEDOUT') || 
        error.message.includes('ENOTFOUND')) {
      return 'high';
    }
    
    // External service errors are high severity
    if (error.message.includes('Firecrawl') || 
        error.message.includes('Google CSE') || 
        error.message.includes('Gemini') || 
        error.message.includes('Supabase')) {
      return 'high';
    }
    
    return 'critical';
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error: Error): boolean {
    // Network errors are retryable
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ETIMEDOUT') || 
        error.message.includes('ENOTFOUND')) {
      return true;
    }
    
    // Rate limiting is retryable
    if (error.name === 'RateLimitError') return true;
    
    // 5xx HTTP errors are retryable
    const statusMatch = error.message.match(/HTTP (5\d{2})/);
    if (statusMatch) return true;
    
    return false;
  }

  /**
   * Log error with comprehensive context
   */
  private static logError(
    error: unknown, 
    errorInfo: any, 
    context: ErrorContext
  ): void {
    const logData = {
      error: {
        type: errorInfo.type,
        name: errorInfo.name,
        message: errorInfo.message,
        code: errorInfo.code,
        severity: errorInfo.severity,
        isRetryable: errorInfo.isRetryable,
        stack: errorInfo.stack
      },
      context: {
        requestId: context.requestId,
        userId: context.userId,
        operation: context.operation,
        service: context.service,
        userAgent: context.userAgent,
        ip: context.ip,
        url: context.url
      },
      timestamp: errorInfo.timestamp.toISOString()
    };

    // Use appropriate log level based on severity
    switch (errorInfo.severity) {
      case 'critical':
        logger.error(`Critical error occurred: ${JSON.stringify(logData)}`);
        break;
      case 'high':
        logger.error(`High severity error: ${JSON.stringify(logData)}`);
        break;
      case 'medium':
        logger.warn(`Medium severity error: ${JSON.stringify(logData)}`);
        break;
      case 'low':
        logger.info(`Low severity error: ${JSON.stringify(logData)}`);
        break;
      default:
        logger.error(`Unknown severity error: ${JSON.stringify(logData)}`);
    }
  }

  /**
   * Update monitoring metrics
   */
  private static async updateMonitoringMetrics(
    errorInfo: any, 
    context: ErrorContext
  ): Promise<void> {
    try {
      // Update integration health if this is a service error
      if (context.service) {
        await integrationHealthMonitor.checkServiceHealth(context.service);
      }
      
      // Log error metrics for monitoring
      logger.info(`Error metrics updated: ${JSON.stringify({
        service: context.service,
        errorCode: errorInfo.code,
        severity: errorInfo.severity,
        isRetryable: errorInfo.isRetryable,
        timestamp: errorInfo.timestamp
      })}`);
    } catch (monitoringError) {
      logger.error(`Failed to update monitoring metrics: ${monitoringError instanceof Error ? monitoringError.message : String(monitoringError)}`);
    }
  }

  /**
   * Generate user-friendly error response
   */
  private static generateErrorResponse(
    errorInfo: any, 
    context: ErrorContext
  ): ErrorResponse {
    const response: ErrorResponse = {
      error: errorInfo.message,
      message: this.getUserFriendlyMessage(errorInfo),
      code: errorInfo.code,
      requestId: context.requestId,
      timestamp: errorInfo.timestamp.toISOString(),
      suggestions: this.getSuggestions(errorInfo, context)
    };

    // Add details for debugging in development
    if (process.env.NODE_ENV === 'development') {
      response.details = {
        type: errorInfo.type,
        name: errorInfo.name,
        severity: errorInfo.severity,
        isRetryable: errorInfo.isRetryable,
        stack: errorInfo.stack
      };
    }

    return response;
  }

  /**
   * Get user-friendly error message
   */
  private static getUserFriendlyMessage(errorInfo: any): string {
    switch (errorInfo.code) {
      case 'VALIDATION_ERROR':
        return 'The request data is invalid. Please check your input and try again.';
      case 'UNAUTHORIZED':
        return 'You are not authorized to perform this action. Please log in and try again.';
      case 'FORBIDDEN':
        return 'You do not have permission to access this resource.';
      case 'NOT_FOUND':
        return 'The requested resource was not found.';
      case 'CONFLICT':
        return 'The request conflicts with the current state of the resource.';
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment and try again.';
      case 'SERVICE_UNAVAILABLE':
        return 'A required service is temporarily unavailable. Please try again later.';
      case 'TIMEOUT':
        return 'The request timed out. Please try again.';
      case 'FIRECRAWL_ERROR':
        return 'Search service is temporarily unavailable. Please try again later.';
      case 'GOOGLE_CSE_ERROR':
        return 'Search service is experiencing issues. Please try again later.';
      case 'GEMINI_ERROR':
        return 'AI processing service is temporarily unavailable. Please try again later.';
      case 'SUPABASE_ERROR':
        return 'Database service is temporarily unavailable. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  /**
   * Get helpful suggestions for the user
   */
  private static getSuggestions(errorInfo: any, context: ErrorContext): string[] {
    const suggestions: string[] = [];

    switch (errorInfo.code) {
      case 'VALIDATION_ERROR':
        suggestions.push('Check that all required fields are provided');
        suggestions.push('Verify that data formats are correct');
        break;
      case 'RATE_LIMITED':
        suggestions.push('Wait a few minutes before making another request');
        suggestions.push('Consider reducing the frequency of your requests');
        break;
      case 'SERVICE_UNAVAILABLE':
      case 'TIMEOUT':
        suggestions.push('Try again in a few minutes');
        suggestions.push('Check your internet connection');
        break;
      case 'FIRECRAWL_ERROR':
      case 'GOOGLE_CSE_ERROR':
        suggestions.push('Try a different search query');
        suggestions.push('Try again in a few minutes');
        break;
      case 'GEMINI_ERROR':
        suggestions.push('Try again in a few minutes');
        suggestions.push('The AI service may be experiencing high load');
        break;
      default:
        if (errorInfo.isRetryable) {
          suggestions.push('This error may be temporary - try again');
        }
        suggestions.push('If the problem persists, please contact support');
    }

    return suggestions;
  }

  /**
   * Create error handler wrapper for API routes
   */
  static withErrorHandling<T extends any[]>(
    handler: (...args: T) => Promise<NextResponse>
  ) {
    return async (...args: T): Promise<NextResponse> => {
      try {
        return await handler(...args);
      } catch (error) {
        const request = args[0] as NextRequest;
        const context: ErrorContext = {
          requestId: request.headers.get('x-request-id') || undefined,
          timestamp: new Date(),
          userAgent: request.headers.get('user-agent') || undefined,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
          url: request.url
        };

        return this.handleError(error, context, request);
      }
    };
  }
}

// Export convenience function
export const withEnhancedErrorHandling = EnhancedErrorHandler.withErrorHandling;
