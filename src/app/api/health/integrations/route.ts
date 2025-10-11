/**
 * Integration Health Check API
 * 
 * Provides comprehensive health status for all external service integrations
 * including retry metrics, circuit breaker status, and service availability.
 */

import { NextRequest, NextResponse } from 'next/server';
import { integrationHealthMonitor } from '@/lib/services/integration-health-monitor';
import { RetryService } from '@/lib/services/retry-service';
import { getAllCircuitBreakerStats } from '@/lib/services/circuit-breaker';
import { withEnhancedErrorHandling } from '@/lib/middleware/enhanced-error-handler';

export interface IntegrationHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastCheck: string;
    responseTime?: number;
    errorRate?: number;
    retryRate?: number;
    circuitBreakerState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    issues: string[];
    recommendations: string[];
  }[];
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    lastUpdated: string;
  };
  metrics: {
    retry: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageAttempts: number;
      averageDelayMs: number;
      retryRate: number;
      serviceBreakdown: Record<string, {
        requests: number;
        successRate: number;
        averageAttempts: number;
      }>;
    };
    circuitBreakers: Record<string, {
      state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
      failureCount: number;
      successCount: number;
      requestCount: number;
      lastFailureTime: number | null;
      lastSuccessTime: number | null;
      nextAttemptTime: number | null;
    }>;
  };
  alerts: string[];
  recommendations: string[];
}

async function GET(request: NextRequest): Promise<NextResponse<IntegrationHealthResponse>> {
  try {
    // Get comprehensive health report
    const healthReport = await integrationHealthMonitor.getHealthReport();
    
    // Get retry metrics
    const retryStats = RetryService.getStatistics(5 * 60 * 1000); // Last 5 minutes
    
    // Get circuit breaker stats
    const circuitBreakerStats = getAllCircuitBreakerStats();
    
    // Transform circuit breaker stats for response
    const transformedCircuitBreakerStats: Record<string, any> = {};
    for (const [service, stats] of Object.entries(circuitBreakerStats)) {
      transformedCircuitBreakerStats[service] = {
        state: stats.state,
        failureCount: stats.failureCount,
        successCount: stats.successCount,
        requestCount: stats.requestCount,
        lastFailureTime: stats.lastFailureTime,
        lastSuccessTime: stats.lastSuccessTime,
        nextAttemptTime: stats.nextAttemptTime
      };
    }
    
    const response: IntegrationHealthResponse = {
      status: healthReport.overallStatus,
      timestamp: new Date().toISOString(),
      services: healthReport.services.map(service => ({
        service: service.service,
        status: service.status,
        lastCheck: service.lastCheck.toISOString(),
        responseTime: service.responseTime,
        errorRate: service.errorRate,
        retryRate: service.retryRate,
        circuitBreakerState: service.circuitBreakerState,
        issues: service.issues,
        recommendations: service.recommendations
      })),
      summary: {
        totalServices: healthReport.summary.totalServices,
        healthyServices: healthReport.summary.healthyServices,
        degradedServices: healthReport.summary.degradedServices,
        unhealthyServices: healthReport.summary.unhealthyServices,
        lastUpdated: healthReport.summary.lastUpdated.toISOString()
      },
      metrics: {
        retry: {
          totalRequests: retryStats.totalRequests,
          successfulRequests: retryStats.successfulRequests,
          failedRequests: retryStats.failedRequests,
          averageAttempts: retryStats.averageAttempts,
          averageDelayMs: retryStats.averageDelayMs,
          retryRate: retryStats.retryRate,
          serviceBreakdown: retryStats.serviceBreakdown
        },
        circuitBreakers: transformedCircuitBreakerStats
      },
      alerts: healthReport.alerts,
      recommendations: healthReport.recommendations
    };
    
    // Set appropriate HTTP status based on overall health
    const httpStatus = healthReport.overallStatus === 'healthy' ? 200 : 
                      healthReport.overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(response, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Integration health check failed:', error);
    
    // Return minimal health response in case of error
    const fallbackResponse: IntegrationHealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: [],
      summary: {
        totalServices: 0,
        healthyServices: 0,
        degradedServices: 0,
        unhealthyServices: 0,
        lastUpdated: new Date().toISOString()
      },
      metrics: {
        retry: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageAttempts: 0,
          averageDelayMs: 0,
          retryRate: 0,
          serviceBreakdown: {}
        },
        circuitBreakers: {}
      },
      alerts: ['Health check system is experiencing issues'],
      recommendations: ['Investigate health monitoring system']
    };
    
    return NextResponse.json(fallbackResponse, { status: 503 });
  }
}

// Export with enhanced error handling
const GETWithErrorHandling = withEnhancedErrorHandling(GET);
export { GETWithErrorHandling as GET };
