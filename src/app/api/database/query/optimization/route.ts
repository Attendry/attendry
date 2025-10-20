/**
 * Database Query Optimization Management API
 * 
 * This API endpoint provides query optimization management functionality including:
 * - Query performance monitoring and analysis
 * - Index recommendations and management
 * - Query caching and optimization
 * - Batch operations and bulk processing
 * - Performance benchmarking and regression detection
 * - Query plan analysis and optimization suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  queryOptimizer,
  executeOptimizedQuery,
  executeBatchOperations,
  getQueryPerformanceMetrics,
  getIndexRecommendations,
  getOptimizationSuggestions,
  getQueryCacheStats,
  clearQueryCache,
  clearQueryMetrics,
  QueryType,
  QueryComplexity
} from '@/lib/query-optimizer';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    switch (action) {
      case 'metrics':
        const metrics = getQueryPerformanceMetrics();
        const filteredMetrics = type ? 
          metrics.filter(m => m.queryType === type) : 
          metrics;
        
        return NextResponse.json({
          success: true,
          data: {
            total: metrics.length,
            filtered: filteredMetrics.length,
            metrics: filteredMetrics.slice(-limit).map(m => ({
              queryId: m.queryId,
              query: m.query.substring(0, 200) + (m.query.length > 200 ? '...' : ''),
              queryType: m.queryType,
              complexity: m.complexity,
              executionTime: m.executionTime,
              rowsReturned: m.rowsReturned,
              cacheHit: m.cacheHit,
              indexUsed: m.indexUsed,
              success: m.success,
              timestamp: new Date(m.timestamp).toISOString(),
              error: m.error
            }))
          }
        });

      case 'recommendations':
        const recommendations = getIndexRecommendations();
        return NextResponse.json({
          success: true,
          data: {
            total: recommendations.length,
            recommendations: recommendations.map(r => ({
              table: r.table,
              columns: r.columns,
              type: r.type,
              estimatedImprovement: r.estimatedImprovement,
              currentPerformance: r.currentPerformance,
              projectedPerformance: r.projectedPerformance,
              confidence: r.confidence,
              reason: r.reason,
              priority: r.priority
            }))
          }
        });

      case 'suggestions':
        const suggestions = getOptimizationSuggestions();
        const filteredSuggestions = type ? 
          suggestions.filter(s => s.type === type) : 
          suggestions;
        
        return NextResponse.json({
          success: true,
          data: {
            total: suggestions.length,
            filtered: filteredSuggestions.length,
            suggestions: filteredSuggestions.slice(-limit).map(s => ({
              queryId: s.queryId,
              originalQuery: s.originalQuery.substring(0, 200) + (s.originalQuery.length > 200 ? '...' : ''),
              optimizedQuery: s.optimizedQuery.substring(0, 200) + (s.optimizedQuery.length > 200 ? '...' : ''),
              estimatedImprovement: s.estimatedImprovement,
              confidence: s.confidence,
              reason: s.reason,
              type: s.type,
              applied: s.applied,
              timestamp: new Date(s.timestamp).toISOString()
            }))
          }
        });

      case 'cache':
        const cacheStats = getQueryCacheStats();
        return NextResponse.json({
          success: true,
          data: cacheStats
        });

      case 'batch':
        const batchOperations = queryOptimizer.getBatchOperations();
        return NextResponse.json({
          success: true,
          data: {
            total: batchOperations.length,
            operations: batchOperations.map(b => ({
              id: b.id,
              operationCount: b.operations.length,
              status: b.status,
              createdAt: new Date(b.createdAt).toISOString(),
              startedAt: b.startedAt ? new Date(b.startedAt).toISOString() : null,
              completedAt: b.completedAt ? new Date(b.completedAt).toISOString() : null,
              duration: b.completedAt && b.startedAt ? b.completedAt - b.startedAt : null,
              errors: b.errors
            }))
          }
        });

      case 'performance':
        const performanceMetrics = getQueryPerformanceMetrics();
        const performance = {
          totalQueries: performanceMetrics.length,
          successfulQueries: performanceMetrics.filter(m => m.success).length,
          failedQueries: performanceMetrics.filter(m => !m.success).length,
          averageExecutionTime: performanceMetrics.reduce((sum, m) => sum + m.executionTime, 0) / performanceMetrics.length || 0,
          slowQueries: performanceMetrics.filter(m => m.executionTime > 2000).length,
          cacheHitRate: performanceMetrics.filter(m => m.cacheHit).length / performanceMetrics.length || 0,
          indexUsageRate: performanceMetrics.filter(m => m.indexUsed).length / performanceMetrics.length || 0,
          complexityDistribution: {
            simple: performanceMetrics.filter(m => m.complexity === QueryComplexity.SIMPLE).length,
            moderate: performanceMetrics.filter(m => m.complexity === QueryComplexity.MODERATE).length,
            complex: performanceMetrics.filter(m => m.complexity === QueryComplexity.COMPLEX).length,
            veryComplex: performanceMetrics.filter(m => m.complexity === QueryComplexity.VERY_COMPLEX).length
          },
          typeDistribution: Object.values(QueryType).reduce((acc, type) => {
            acc[type] = performanceMetrics.filter(m => m.queryType === type).length;
            return acc;
          }, {} as Record<QueryType, number>)
        };
        
        return NextResponse.json({
          success: true,
          data: performance
        });

      case 'status':
        const status = {
          metrics: getQueryPerformanceMetrics().length,
          recommendations: getIndexRecommendations().length,
          suggestions: getOptimizationSuggestions().length,
          cache: getQueryCacheStats(),
          batchOperations: queryOptimizer.getBatchOperations().length,
          lastUpdate: new Date().toISOString()
        };
        
        return NextResponse.json({
          success: true,
          data: status
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: metrics, recommendations, suggestions, cache, batch, performance, status'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[query-optimization] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, query, params, cacheKey, connectionId, operations, suggestionId } = body;

    switch (action) {
      case 'execute':
        if (!query) {
          return NextResponse.json({
            success: false,
            error: 'Query is required for execution'
          }, { status: 400 });
        }

        try {
          const result = await executeOptimizedQuery(
            async () => {
              // Simulate query execution
              if (typeof query === 'function') {
                return await query();
              }
              return { success: true, timestamp: Date.now(), query: 'test' };
            },
            query,
            params,
            cacheKey,
            connectionId
          );
          
          return NextResponse.json({
            success: true,
            message: 'Query executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Query execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'batch':
        if (!operations || !Array.isArray(operations)) {
          return NextResponse.json({
            success: false,
            error: 'Operations array is required for batch execution'
          }, { status: 400 });
        }

        try {
          const results = await executeBatchOperations(operations);
          return NextResponse.json({
            success: true,
            message: `Batch execution completed with ${operations.length} operations`,
            data: { resultCount: results.length, results }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Batch execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'apply-suggestion':
        if (!suggestionId) {
          return NextResponse.json({
            success: false,
            error: 'Suggestion ID is required'
          }, { status: 400 });
        }

        const applied = queryOptimizer.applyOptimizationSuggestion(suggestionId);
        if (applied) {
          return NextResponse.json({
            success: true,
            message: `Optimization suggestion ${suggestionId} applied successfully`
          });
        } else {
          return NextResponse.json({
            success: false,
            error: `Optimization suggestion ${suggestionId} not found`
          }, { status: 404 });
        }

      case 'test-performance':
        const testQueries = [
          { type: QueryType.SELECT, query: 'SELECT * FROM users WHERE id = ?', params: [1] },
          { type: QueryType.SELECT, query: 'SELECT * FROM events WHERE date > ?', params: [new Date()] },
          { type: QueryType.SELECT, query: 'SELECT COUNT(*) FROM events', params: [] }
        ];

        try {
          const results = [];
          for (const testQuery of testQueries) {
            const result = await executeOptimizedQuery(
              async () => {
                // Simulate query execution
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
                return { success: true, query: testQuery.query, timestamp: Date.now() };
              },
              testQuery.query,
              testQuery.params,
              `test_${testQuery.query}`,
              'test_connection'
            );
            results.push(result);
          }
          
          return NextResponse.json({
            success: true,
            message: 'Performance test completed',
            data: { resultCount: results.length, results }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Performance test failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'simulate-load':
        const loadQueries = Array.from({ length: 10 }, (_, i) => ({
          type: QueryType.SELECT,
          query: `SELECT * FROM table_${i} WHERE id = ?`,
          params: [i],
          priority: Math.floor(Math.random() * 5) + 1
        }));

        try {
          const results = await executeBatchOperations(loadQueries);
          return NextResponse.json({
            success: true,
            message: `Load simulation completed with ${loadQueries.length} queries`,
            data: { resultCount: results.length, results }
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
          error: 'Invalid action. Supported actions: execute, batch, apply-suggestion, test-performance, simulate-load'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[query-optimization] POST error:', error);
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
      case 'cache':
        clearQueryCache();
        return NextResponse.json({
          success: true,
          message: 'Query cache cleared successfully'
        });

      case 'metrics':
        clearQueryMetrics();
        return NextResponse.json({
          success: true,
          message: 'Query metrics cleared successfully'
        });

      case 'all':
        clearQueryCache();
        clearQueryMetrics();
        return NextResponse.json({
          success: true,
          message: 'All query optimization data cleared successfully'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: cache, metrics, all'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[query-optimization] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
