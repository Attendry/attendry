/**
 * Advanced Database Pool Management API
 * 
 * This API endpoint provides advanced database pool management functionality including:
 * - Pool metrics and analytics
 * - Connection health monitoring
 * - Query performance analysis
 * - Pool scaling and optimization
 * - Connection lifecycle management
 * - Performance monitoring and recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  advancedDatabasePool,
  getAdvancedPoolMetrics,
  getAdvancedPoolAnalytics,
  warmAdvancedConnections,
  resetAdvancedPool,
  ConnectionType,
  ConnectionHealth
} from '@/lib/advanced-database-pool';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const type = url.searchParams.get('type');

    switch (action) {
      case 'metrics':
        const metrics = getAdvancedPoolMetrics();
        return NextResponse.json({
          success: true,
          data: metrics
        });

      case 'analytics':
        const analytics = getAdvancedPoolAnalytics();
        return NextResponse.json({
          success: true,
          data: analytics
        });

      case 'connections':
        const connections = advancedDatabasePool.getConnections();
        const filteredConnections = type ? 
          connections.filter(conn => conn.type === type) : 
          connections;
        
        return NextResponse.json({
          success: true,
          data: {
            total: connections.length,
            filtered: filteredConnections.length,
            connections: filteredConnections.map(conn => ({
              id: conn.id,
              type: conn.type,
              health: conn.health,
              createdAt: new Date(conn.createdAt).toISOString(),
              lastUsed: new Date(conn.lastUsed).toISOString(),
              lastHealthCheck: new Date(conn.lastHealthCheck).toISOString(),
              queryCount: conn.queryCount,
              errorCount: conn.errorCount,
              averageResponseTime: conn.averageResponseTime,
              isActive: conn.isActive,
              metadata: conn.metadata
            }))
          }
        });

      case 'health':
        const healthMetrics = advancedDatabasePool.getConnections();
        const healthStatus = {
          total: healthMetrics.length,
          healthy: healthMetrics.filter(c => c.health === ConnectionHealth.HEALTHY).length,
          degraded: healthMetrics.filter(c => c.health === ConnectionHealth.DEGRADED).length,
          unhealthy: healthMetrics.filter(c => c.health === ConnectionHealth.UNHEALTHY).length,
          unknown: healthMetrics.filter(c => c.health === ConnectionHealth.UNKNOWN).length,
          active: healthMetrics.filter(c => c.isActive).length,
          idle: healthMetrics.filter(c => !c.isActive).length,
          lastUpdate: new Date().toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: healthStatus
        });

      case 'performance':
        const performanceData = getAdvancedPoolAnalytics();
        const performance = {
          current: performanceData.metrics,
          trends: performanceData.performanceTrends,
          recommendations: performanceData.recommendations,
          lastUpdate: new Date(performanceData.lastUpdate).toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: performance
        });

      case 'status':
        const status = {
          metrics: getAdvancedPoolMetrics(),
          connections: advancedDatabasePool.getConnections().length,
          health: {
            healthy: advancedDatabasePool.getConnections().filter(c => c.health === ConnectionHealth.HEALTHY).length,
            unhealthy: advancedDatabasePool.getConnections().filter(c => c.health === ConnectionHealth.UNHEALTHY).length,
            active: advancedDatabasePool.getConnections().filter(c => c.isActive).length
          },
          lastUpdate: new Date().toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: status
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: metrics, analytics, connections, health, performance, status'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[database-pool-management] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, count, type, query, cacheKey } = body;

    switch (action) {
      case 'warm':
        const warmCount = count || 2;
        await warmAdvancedConnections(warmCount);
        
        return NextResponse.json({
          success: true,
          message: `Warmed ${warmCount} connections successfully`
        });

      case 'test-query':
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'Query is required for testing'
          }, { status: 400 });
        }

        try {
          const connectionType = type === 'admin' ? ConnectionType.ADMIN : ConnectionType.SERVER;
          const result = await advancedDatabasePool.executeQuery(
            async () => {
              // Simulate query execution
              if (typeof query === 'function') {
                return await query();
              }
              return { success: true, timestamp: Date.now(), query: 'test' };
            },
            connectionType,
            cacheKey
          );
          
          return NextResponse.json({
            success: true,
            message: 'Query test successful',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Query test failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'simulate-load':
        const loadCount = count || 10;
        const promises = [];
        
        for (let i = 0; i < loadCount; i++) {
          promises.push(
            advancedDatabasePool.executeQuery(
              async () => {
                // Simulate database operation
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
                return { id: i, timestamp: Date.now() };
              },
              ConnectionType.SERVER,
              `load_test_${i}`
            )
          );
        }
        
        try {
          const results = await Promise.all(promises);
          return NextResponse.json({
            success: true,
            message: `Load test completed with ${loadCount} operations`,
            data: { results: results.length, metrics: getAdvancedPoolMetrics() }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Load test failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'optimize':
        // Trigger pool optimization
        const beforeMetrics = getAdvancedPoolMetrics();
        await advancedDatabasePool.performCleanup();
        const afterMetrics = getAdvancedPoolMetrics();
        
        return NextResponse.json({
          success: true,
          message: 'Pool optimization completed',
          data: {
            before: beforeMetrics,
            after: afterMetrics,
            improvements: {
              connectionsRemoved: beforeMetrics.totalConnections - afterMetrics.totalConnections,
              memorySaved: beforeMetrics.memoryUsage - afterMetrics.memoryUsage
            }
          }
        });

      case 'reset':
        await resetAdvancedPool();
        return NextResponse.json({
          success: true,
          message: 'Database pool reset successfully'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: warm, test-query, simulate-load, optimize, reset'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[database-pool-management] POST error:', error);
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
      case 'reset':
        await resetAdvancedPool();
        return NextResponse.json({
          success: true,
          message: 'Database pool reset successfully'
        });

      case 'cleanup':
        // Perform cleanup without full reset
        await advancedDatabasePool.performCleanup();
        return NextResponse.json({
          success: true,
          message: 'Database pool cleanup completed'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: reset, cleanup'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[database-pool-management] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
