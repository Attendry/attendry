/**
 * Integration Health Monitor
 * 
 * Monitors the health of external service integrations and provides
 * comprehensive status reporting and alerting capabilities.
 */

import { RetryService } from './retry-service';
import { getAllCircuitBreakerStats } from './circuit-breaker';
import { logger } from '@/utils/logger';

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime?: number;
  errorRate?: number;
  retryRate?: number;
  circuitBreakerState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  issues: string[];
  recommendations: string[];
}

export interface IntegrationHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    lastUpdated: Date;
  };
  alerts: string[];
  recommendations: string[];
}

export class IntegrationHealthMonitor {
  private static instance: IntegrationHealthMonitor;
  private healthCache = new Map<string, ServiceHealth>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  static getInstance(): IntegrationHealthMonitor {
    if (!IntegrationHealthMonitor.instance) {
      IntegrationHealthMonitor.instance = new IntegrationHealthMonitor();
    }
    return IntegrationHealthMonitor.instance;
  }

  /**
   * Get comprehensive health report for all integrations
   */
  async getHealthReport(): Promise<IntegrationHealthReport> {
    const services = await this.checkAllServices();
    const circuitBreakerStats = getAllCircuitBreakerStats();
    
    // Merge circuit breaker information
    const enhancedServices = services.map(service => {
      const cbStats = circuitBreakerStats[service.service];
      if (cbStats) {
        return {
          ...service,
          circuitBreakerState: cbStats.state,
          issues: [
            ...service.issues,
            ...(cbStats.state === 'OPEN' ? ['Circuit breaker is OPEN - service unavailable'] : []),
            ...(cbStats.state === 'HALF_OPEN' ? ['Circuit breaker is HALF_OPEN - testing recovery'] : [])
          ]
        };
      }
      return service;
    });

    const summary = this.calculateSummary(enhancedServices);
    const overallStatus = this.determineOverallStatus(enhancedServices);
    const alerts = this.generateAlerts(enhancedServices);
    const recommendations = this.generateRecommendations(enhancedServices);

    return {
      overallStatus,
      services: enhancedServices,
      summary,
      alerts,
      recommendations
    };
  }

  /**
   * Check health of a specific service
   */
  async checkServiceHealth(service: string): Promise<ServiceHealth> {
    const cacheKey = service;
    const cached = this.healthCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.lastCheck.getTime()) < this.CACHE_TTL_MS) {
      return cached;
    }

    const health = await this.performHealthCheck(service);
    this.healthCache.set(cacheKey, health);
    
    return health;
  }

  /**
   * Check all services
   */
  private async checkAllServices(): Promise<ServiceHealth[]> {
    const services = ['firecrawl', 'google_cse', 'gemini', 'supabase'];
    const healthChecks = await Promise.allSettled(
      services.map(service => this.checkServiceHealth(service))
    );

    return healthChecks
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            service: services[index],
            status: 'unknown' as const,
            lastCheck: new Date(),
            issues: ['Health check failed'],
            recommendations: ['Investigate service connectivity']
          };
        }
      });
  }

  /**
   * Perform health check for a specific service
   */
  private async performHealthCheck(service: string): Promise<ServiceHealth> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Get retry metrics for the service
      const retryStats = RetryService.getStatistics(5 * 60 * 1000); // Last 5 minutes
      const serviceStats = retryStats.serviceBreakdown[service];

      if (serviceStats) {
        const responseTime = Date.now() - startTime;
        const errorRate = 1 - serviceStats.successRate;
        const retryRate = retryStats.retryRate;

        // Determine status based on metrics
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        
        if (errorRate > 0.2) {
          status = 'unhealthy';
          issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
          recommendations.push('Check service configuration and network connectivity');
        } else if (errorRate > 0.1) {
          status = 'degraded';
          issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(1)}%`);
          recommendations.push('Monitor service performance closely');
        }

        if (retryRate > 0.3) {
          status = status === 'healthy' ? 'degraded' : status;
          issues.push(`High retry rate: ${(retryRate * 100).toFixed(1)}%`);
          recommendations.push('Consider increasing retry delays or checking service load');
        }

        if (serviceStats.averageAttempts > 1.5) {
          status = status === 'healthy' ? 'degraded' : status;
          issues.push(`High average attempts: ${serviceStats.averageAttempts.toFixed(2)}`);
          recommendations.push('Review retry configuration and service reliability');
        }

        return {
          service,
          status,
          lastCheck: new Date(),
          responseTime,
          errorRate,
          retryRate,
          issues,
          recommendations
        };
      } else {
        // No recent metrics - perform a simple connectivity test
        const isHealthy = await this.performConnectivityTest(service);
        return {
          service,
          status: isHealthy ? 'healthy' : 'degraded',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          issues: isHealthy ? [] : ['No recent activity or connectivity issues'],
          recommendations: isHealthy ? [] : ['Check service configuration and network connectivity']
        };
      }
    } catch (error) {
      logger.error(`Health check failed for ${service}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        service,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        issues: ['Health check failed'],
        recommendations: ['Investigate service connectivity and configuration']
      };
    }
  }

  /**
   * Perform a simple connectivity test
   */
  private async performConnectivityTest(service: string): Promise<boolean> {
    try {
      // This is a simplified test - in a real implementation, you might
      // make a lightweight API call to test connectivity
      switch (service) {
        case 'firecrawl':
          // Test Firecrawl connectivity
          return process.env.FIRECRAWL_KEY ? true : false;
        case 'google_cse':
          // Test Google CSE connectivity
          return !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_CX);
        case 'gemini':
          // Test Gemini connectivity
          return !!process.env.GEMINI_API_KEY;
        case 'supabase':
          // Test Supabase connectivity
          return !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Connectivity test failed for ${service}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(services: ServiceHealth[]) {
    const totalServices = services.length;
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;

    return {
      totalServices,
      healthyServices,
      degradedServices,
      unhealthyServices,
      lastUpdated: new Date()
    };
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(services: ServiceHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate alerts for critical issues
   */
  private generateAlerts(services: ServiceHealth[]): string[] {
    const alerts: string[] = [];

    services.forEach(service => {
      if (service.status === 'unhealthy') {
        alerts.push(`🚨 ${service.service} is UNHEALTHY - immediate attention required`);
      } else if (service.status === 'degraded') {
        alerts.push(`⚠️ ${service.service} is DEGRADED - monitor closely`);
      }

      if (service.circuitBreakerState === 'OPEN') {
        alerts.push(`🔴 ${service.service} circuit breaker is OPEN - service unavailable`);
      }
    });

    return alerts;
  }

  /**
   * Generate recommendations for improving system health
   */
  private generateRecommendations(services: ServiceHealth[]): string[] {
    const recommendations: string[] = [];

    services.forEach(service => {
      recommendations.push(...service.recommendations);
    });

    // Add general recommendations
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      recommendations.push('Review and update service configurations for unhealthy services');
    }

    const degradedServices = services.filter(s => s.status === 'degraded');
    if (degradedServices.length > 0) {
      recommendations.push('Monitor degraded services and consider scaling or optimization');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
  }

  /**
   * Get health status for monitoring dashboards
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    details: Record<string, any>;
  }> {
    const report = await this.getHealthReport();
    
    let message: string;
    switch (report.overallStatus) {
      case 'healthy':
        message = 'All integrations are healthy';
        break;
      case 'degraded':
        message = `${report.summary.degradedServices} service(s) are degraded`;
        break;
      case 'unhealthy':
        message = `${report.summary.unhealthyServices} service(s) are unhealthy`;
        break;
    }

    return {
      status: report.overallStatus,
      message,
      details: {
        summary: report.summary,
        alerts: report.alerts,
        services: report.services.map(s => ({
          service: s.service,
          status: s.status,
          circuitBreakerState: s.circuitBreakerState
        }))
      }
    };
  }
}

// Export singleton instance
export const integrationHealthMonitor = IntegrationHealthMonitor.getInstance();
