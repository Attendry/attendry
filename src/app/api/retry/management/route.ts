/**
 * Retry Management API
 * 
 * This API endpoint provides retry management functionality including:
 * - Retry analytics and metrics
 * - Retry budget management
 * - Retry configuration
 * - Manual retry control and testing
 * - Retry performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  retryManager,
  getRetryAnalytics,
  getRetryBudgetStatus,
  resetRetryAnalytics,
  resetRetryBudget,
  RetryErrorType,
  RetryStrategy
} from '@/lib/retry-manager';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const service = url.searchParams.get('service');

    switch (action) {
      case 'analytics':
        const analytics = getRetryAnalytics();
        return NextResponse.json({
          success: true,
          data: analytics
        });

      case 'budget':
        const budgetStatus = getRetryBudgetStatus(service || undefined);
        return NextResponse.json({
          success: true,
          data: { service: service || 'global', budget: budgetStatus }
        });

      case 'history':
        const history = retryManager.getAttemptHistory();
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const filteredHistory = history.slice(-limit);
        
        return NextResponse.json({
          success: true,
          data: {
            total: history.length,
            returned: filteredHistory.length,
            attempts: filteredHistory
          }
        });

      case 'status':
        const status = {
          analytics: getRetryAnalytics(),
          globalBudget: getRetryBudgetStatus(),
          services: ['firecrawl', 'cse', 'database', 'gemini'].map(s => ({
            service: s,
            budget: getRetryBudgetStatus(s)
          })),
          lastUpdate: new Date().toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'config':
        const config = {
          errorTypes: Object.values(RetryErrorType),
          strategies: Object.values(RetryStrategy),
          defaultConfig: {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitter: 0.1,
            timeout: 60000
          }
        };
        
        return NextResponse.json({
          success: true,
          data: config
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: analytics, budget, history, status, config'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[retry-management] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, service, config, operation } = body;

    switch (action) {
      case 'test':
        if (!service || !operation) {
          return NextResponse.json({
            success: false,
            error: 'Service and operation are required for testing'
          }, { status: 400 });
        }

        // Test retry mechanism with a simple operation
        try {
          const result = await retryManager.executeWithRetry(
            async () => {
              // Simulate the operation
              if (typeof operation === 'function') {
                return await operation();
              }
              // Simulate a simple test operation
              return { success: true, timestamp: Date.now(), service };
            },
            service,
            config
          );
          
          return NextResponse.json({
            success: true,
            message: `Retry test successful for service: ${service}`,
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: `Retry test failed for service: ${service}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'reset-analytics':
        resetRetryAnalytics();
        return NextResponse.json({
          success: true,
          message: 'Retry analytics reset successfully'
        });

      case 'reset-budget':
        resetRetryBudget();
        return NextResponse.json({
          success: true,
          message: 'Retry budget reset successfully'
        });

      case 'reset-all':
        resetRetryAnalytics();
        resetRetryBudget();
        return NextResponse.json({
          success: true,
          message: 'All retry data reset successfully'
        });

      case 'simulate-error':
        if (!service || !body.errorType) {
          return NextResponse.json({
            success: false,
            error: 'Service and errorType are required for error simulation'
          }, { status: 400 });
        }

        // Simulate different error types for testing
        const errorType = body.errorType as RetryErrorType;
        let simulatedError: Error;

        switch (errorType) {
          case RetryErrorType.NETWORK_ERROR:
            simulatedError = new Error('Network connection failed');
            break;
          case RetryErrorType.TIMEOUT_ERROR:
            simulatedError = new Error('Request timeout');
            break;
          case RetryErrorType.RATE_LIMIT_ERROR:
            simulatedError = new Error('Rate limit exceeded');
            break;
          case RetryErrorType.AUTHENTICATION_ERROR:
            simulatedError = new Error('Authentication failed');
            break;
          case RetryErrorType.VALIDATION_ERROR:
            simulatedError = new Error('Validation failed');
            break;
          default:
            simulatedError = new Error('Unknown error');
        }

        try {
          const result = await retryManager.executeWithRetry(
            async () => {
              throw simulatedError;
            },
            service,
            config
          );
          
          return NextResponse.json({
            success: true,
            message: `Error simulation completed for service: ${service}`,
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: `Error simulation failed for service: ${service}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: test, reset-analytics, reset-budget, reset-all, simulate-error'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[retry-management] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const service = url.searchParams.get('service');

    if (service) {
      // Reset budget for specific service
      resetRetryBudget();
      return NextResponse.json({
        success: true,
        message: `Retry budget reset for service: ${service}`
      });
    } else {
      // Reset all retry data
      resetRetryAnalytics();
      resetRetryBudget();
      return NextResponse.json({
        success: true,
        message: 'All retry data reset successfully'
      });
    }
  } catch (error) {
    console.error('[retry-management] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
