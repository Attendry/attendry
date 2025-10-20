/**
 * Production Readiness Management API
 * 
 * This API endpoint provides production readiness management functionality including:
 * - System health monitoring and status reporting
 * - SLA monitoring and metrics tracking
 * - Performance monitoring and alerting
 * - Production readiness assessment and reporting
 * - Deployment validation and rollback capabilities
 * - Operational metrics and monitoring dashboards
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  productionReadinessManager,
  generateProductionReadinessReport,
  getSystemHealthSummary,
  getSLAMetrics,
  startProductionMonitoring,
  stopProductionMonitoring,
  getHealthChecks,
  getPerformanceMetrics,
  isProductionMonitoringActive,
  SystemHealthStatus,
  ComponentHealthStatus,
  SLAStatus
} from '@/lib/production-readiness';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const component = url.searchParams.get('component');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    switch (action) {
      case 'health':
        const healthSummary = await getSystemHealthSummary();
        return NextResponse.json({
          success: true,
          data: healthSummary
        });

      case 'health-checks':
        const healthChecks = getHealthChecks();
        const filteredHealthChecks = component ? 
          healthChecks.filter(h => h.component === component) : 
          healthChecks;
        
        return NextResponse.json({
          success: true,
          data: {
            total: healthChecks.length,
            filtered: filteredHealthChecks.length,
            healthChecks: filteredHealthChecks.map(h => ({
              component: h.component,
              status: h.status,
              responseTime: h.responseTime,
              lastCheck: new Date(h.lastCheck).toISOString(),
              error: h.error,
              metadata: h.metadata
            }))
          }
        });

      case 'sla':
        const slaMetrics = await getSLAMetrics();
        return NextResponse.json({
          success: true,
          data: slaMetrics
        });

      case 'performance':
        const performanceMetrics = getPerformanceMetrics();
        return NextResponse.json({
          success: true,
          data: {
            total: performanceMetrics.length,
            metrics: performanceMetrics.slice(-limit).map(m => ({
              timestamp: new Date(m.timestamp).toISOString(),
              cpuUsage: m.cpuUsage,
              memoryUsage: m.memoryUsage,
              diskUsage: m.diskUsage,
              responseTime: m.responseTime,
              throughput: m.throughput,
              errorRate: m.errorRate,
              activeConnections: m.activeConnections,
              cacheHitRate: m.cacheHitRate,
              databaseConnections: m.databaseConnections
            }))
          }
        });

      case 'readiness-report':
        const readinessReport = await generateProductionReadinessReport();
        return NextResponse.json({
          success: true,
          data: readinessReport
        });

      case 'status':
        const status = {
          monitoringActive: isProductionMonitoringActive(),
          lastHealthCheck: getHealthChecks().length > 0 ? 
            new Date(Math.max(...getHealthChecks().map(h => h.lastCheck))).toISOString() : 
            null,
          systemHealth: await getSystemHealthSummary(),
          slaMetrics: await getSLAMetrics(),
          performanceMetricsCount: getPerformanceMetrics().length,
          availableComponents: [
            'database',
            'cache',
            'search-pipeline',
            'event-extraction',
            'speaker-enhancement',
            'circuit-breakers',
            'retry-mechanisms',
            'performance-monitor',
            'alerting-system',
            'api-endpoints'
          ],
          availableStatuses: {
            systemHealth: Object.values(SystemHealthStatus),
            componentHealth: Object.values(ComponentHealthStatus),
            slaStatus: Object.values(SLAStatus)
          }
        };
        
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'dashboard':
        const dashboard = {
          systemHealth: await getSystemHealthSummary(),
          slaMetrics: await getSLAMetrics(),
          recentPerformance: getPerformanceMetrics().slice(-10),
          healthChecks: getHealthChecks(),
          monitoringStatus: isProductionMonitoringActive(),
          lastUpdate: new Date().toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: dashboard
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: health, health-checks, sla, performance, readiness-report, status, dashboard'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[production-readiness] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, component, force } = body;

    switch (action) {
      case 'start-monitoring':
        startProductionMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Production monitoring started successfully'
        });

      case 'stop-monitoring':
        stopProductionMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Production monitoring stopped successfully'
        });

      case 'health-check':
        if (!component) {
          return NextResponse.json({
            success: false,
            error: 'Component is required for health check'
          }, { status: 400 });
        }

        try {
          const healthCheck = await productionReadinessManager.performHealthCheck(component);
          return NextResponse.json({
            success: true,
            message: `Health check completed for component: ${component}`,
            data: healthCheck
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: `Health check failed for component: ${component}`,
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'health-check-all':
        try {
          const components = [
            'database',
            'cache',
            'search-pipeline',
            'event-extraction',
            'speaker-enhancement',
            'circuit-breakers',
            'retry-mechanisms',
            'performance-monitor',
            'alerting-system',
            'api-endpoints'
          ];

          const results = [];
          for (const comp of components) {
            const result = await productionReadinessManager.performHealthCheck(comp);
            results.push(result);
          }

          return NextResponse.json({
            success: true,
            message: `Health checks completed for ${components.length} components`,
            data: { results, componentCount: components.length }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Health checks failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'collect-metrics':
        try {
          const metrics = await productionReadinessManager.collectPerformanceMetrics();
          return NextResponse.json({
            success: true,
            message: 'Performance metrics collected successfully',
            data: metrics
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Performance metrics collection failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'calculate-sla':
        try {
          const slaMetrics = await productionReadinessManager.calculateSLAMetrics();
          return NextResponse.json({
            success: true,
            message: 'SLA metrics calculated successfully',
            data: slaMetrics
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'SLA metrics calculation failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'generate-report':
        try {
          const report = await generateProductionReadinessReport();
          return NextResponse.json({
            success: true,
            message: 'Production readiness report generated successfully',
            data: report
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Production readiness report generation failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'validate-deployment':
        try {
          const report = await generateProductionReadinessReport();
          const deploymentReady = report.deploymentReadiness.ready;
          
          return NextResponse.json({
            success: true,
            message: deploymentReady ? 'Deployment validation passed' : 'Deployment validation failed',
            data: {
              ready: deploymentReady,
              readinessScore: report.readinessScore,
              issues: report.deploymentReadiness.issues,
              warnings: report.deploymentReadiness.warnings,
              report: report
            }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Deployment validation failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'validate-operations':
        try {
          const report = await generateProductionReadinessReport();
          const operationsReady = report.operationalReadiness.ready;
          
          return NextResponse.json({
            success: true,
            message: operationsReady ? 'Operations validation passed' : 'Operations validation failed',
            data: {
              ready: operationsReady,
              readinessScore: report.readinessScore,
              issues: report.operationalReadiness.issues,
              warnings: report.operationalReadiness.warnings,
              report: report
            }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Operations validation failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'simulate-load':
        try {
          // Simulate load testing
          const loadResults = [];
          for (let i = 0; i < 10; i++) {
            const startTime = Date.now();
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
            const duration = Date.now() - startTime;
            loadResults.push({ requestId: i, duration, success: true });
          }
          
          return NextResponse.json({
            success: true,
            message: 'Load simulation completed successfully',
            data: { results: loadResults, requestCount: loadResults.length }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Load simulation failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: start-monitoring, stop-monitoring, health-check, health-check-all, collect-metrics, calculate-sla, generate-report, validate-deployment, validate-operations, simulate-load'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[production-readiness] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'clear-data':
        productionReadinessManager.clearData();
        return NextResponse.json({
          success: true,
          message: 'Production readiness data cleared successfully'
        });

      case 'stop-monitoring':
        stopProductionMonitoring();
        return NextResponse.json({
          success: true,
          message: 'Production monitoring stopped successfully'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: clear-data, stop-monitoring'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[production-readiness] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
