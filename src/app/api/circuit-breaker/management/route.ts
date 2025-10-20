/**
 * Circuit Breaker Management API
 * 
 * This API endpoint provides circuit breaker management functionality including:
 * - Circuit breaker status and metrics
 * - Circuit breaker configuration
 * - Manual circuit breaker control (reset, open, close)
 * - Circuit breaker analytics and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  circuitBreakerManager,
  CircuitState,
  CircuitMetrics
} from '@/lib/circuit-breaker';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const service = url.searchParams.get('service');

    switch (action) {
      case 'status':
        const allMetrics = circuitBreakerManager.getCircuitBreakerMetrics();
        const status = {
          services: Object.keys(allMetrics),
          totalServices: Object.keys(allMetrics).length,
          openCircuits: Object.values(allMetrics).filter(m => m.circuitState === CircuitState.OPEN).length,
          halfOpenCircuits: Object.values(allMetrics).filter(m => m.circuitState === CircuitState.HALF_OPEN).length,
          closedCircuits: Object.values(allMetrics).filter(m => m.circuitState === CircuitState.CLOSED).length,
          lastUpdate: new Date().toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'metrics':
        if (service) {
          const metrics = circuitBreakerManager.getCircuitBreaker(service)?.getMetrics();
          if (!metrics) {
            return NextResponse.json({
              success: false,
              error: `Circuit breaker not found for service: ${service}`
            }, { status: 404 });
          }
          
          return NextResponse.json({
            success: true,
            data: { service, metrics }
          });
        } else {
          const allMetrics = circuitBreakerManager.getCircuitBreakerMetrics();
          return NextResponse.json({
            success: true,
            data: allMetrics
          });
        }

      case 'state':
        if (!service) {
          return NextResponse.json({
            success: false,
            error: 'Service parameter is required for state check'
          }, { status: 400 });
        }
        
        const circuitBreaker = circuitBreakerManager.getCircuitBreaker(service);
        if (!circuitBreaker) {
          return NextResponse.json({
            success: false,
            error: `Circuit breaker not found for service: ${service}`
          }, { status: 404 });
        }
        
        const state = circuitBreaker.getState();
        const config = circuitBreaker.getConfig();
        
        return NextResponse.json({
          success: true,
          data: { service, state, config }
        });

      case 'health':
        const healthMetrics = circuitBreakerManager.getCircuitBreakerMetrics();
        const healthStatus = Object.entries(healthMetrics).map(([serviceName, metrics]) => ({
          service: serviceName,
          state: metrics.circuitState,
          healthy: metrics.circuitState === CircuitState.CLOSED,
          errorRate: metrics.errorRate,
          averageResponseTime: metrics.averageResponseTime,
          totalCalls: metrics.totalCalls,
          lastStateChange: new Date(metrics.lastStateChange).toISOString()
        }));
        
        return NextResponse.json({
          success: true,
          data: {
            services: healthStatus,
            overallHealth: healthStatus.every(s => s.healthy),
            unhealthyServices: healthStatus.filter(s => !s.healthy).map(s => s.service)
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: status, metrics, state, health'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[circuit-breaker-management] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, service, state } = body;

    switch (action) {
      case 'reset':
        if (!service) {
          return NextResponse.json({
            success: false,
            error: 'Service parameter is required for reset'
          }, { status: 400 });
        }

        const reset = circuitBreakerManager.resetCircuitBreaker(service);
        if (!reset) {
          return NextResponse.json({
            success: false,
            error: `Circuit breaker not found for service: ${service}`
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          message: `Circuit breaker reset for service: ${service}`
        });

      case 'reset-all':
        circuitBreakerManager.resetAllCircuitBreakers();
        
        return NextResponse.json({
          success: true,
          message: 'All circuit breakers reset'
        });

      case 'force-state':
        if (!service || !state) {
          return NextResponse.json({
            success: false,
            error: 'Service and state parameters are required for force-state'
          }, { status: 400 });
        }

        const circuitBreaker = circuitBreakerManager.getCircuitBreaker(service);
        if (!circuitBreaker) {
          return NextResponse.json({
            success: false,
            error: `Circuit breaker not found for service: ${service}`
          }, { status: 404 });
        }

        // Force circuit breaker to specific state (for testing/debugging)
        if (state === 'open') {
          // Force open by setting consecutive failures
          (circuitBreaker as any).consecutiveFailures = 999;
          (circuitBreaker as any).state = CircuitState.OPEN;
        } else if (state === 'closed') {
          circuitBreaker.reset();
        } else if (state === 'half-open') {
          (circuitBreaker as any).state = CircuitState.HALF_OPEN;
          (circuitBreaker as any).consecutiveFailures = 0;
          (circuitBreaker as any).consecutiveSuccesses = 0;
        }
        
        return NextResponse.json({
          success: true,
          message: `Circuit breaker state forced to ${state} for service: ${service}`
        });

      case 'test':
        if (!service) {
          return NextResponse.json({
            success: false,
            error: 'Service parameter is required for testing'
          }, { status: 400 });
        }

        const testCircuitBreaker = circuitBreakerManager.getCircuitBreaker(service);
        if (!testCircuitBreaker) {
          return NextResponse.json({
            success: false,
            error: `Circuit breaker not found for service: ${service}`
          }, { status: 404 });
        }

        // Test circuit breaker with a simple operation
        try {
          const result = await testCircuitBreaker.execute(async () => {
            // Simulate a successful operation
            return { success: true, timestamp: Date.now() };
          });
          
          return NextResponse.json({
            success: true,
            message: `Circuit breaker test successful for service: ${service}`,
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: `Circuit breaker test failed for service: ${service}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: reset, reset-all, force-state, test'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[circuit-breaker-management] POST error:', error);
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

    if (!service) {
      return NextResponse.json({
        success: false,
        error: 'Service parameter is required for deletion'
      }, { status: 400 });
    }

    // Note: In a real implementation, you might want to add a method to remove circuit breakers
    // For now, we'll just reset it
    const reset = circuitBreakerManager.resetCircuitBreaker(service);
    if (!reset) {
      return NextResponse.json({
        success: false,
        error: `Circuit breaker not found for service: ${service}`
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Circuit breaker reset for service: ${service}`
    });
  } catch (error) {
    console.error('[circuit-breaker-management] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
