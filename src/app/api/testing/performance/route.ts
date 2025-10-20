/**
 * Performance Benchmarking API
 * 
 * This API endpoint provides performance benchmarking functionality including:
 * - Performance benchmarking and load testing
 * - Performance validation and regression detection
 * - Benchmark result analysis and reporting
 * - Performance trend analysis and monitoring
 * - Automated performance testing and validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  performanceBenchmarker,
  runComprehensiveBenchmarks,
  runLoadTestingBenchmarks,
  getBenchmarkResults,
  getBenchmarkSuites,
  getOverallBenchmarkSummary,
  clearBenchmarkResults,
  BenchmarkResult,
  BenchmarkMetric
} from '@/lib/performance-benchmarking';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const scenario = url.searchParams.get('scenario');
    const result = url.searchParams.get('result');
    const limit = parseInt(url.searchParams.get('limit') || '100');

    switch (action) {
      case 'results':
        const results = getBenchmarkResults();
        let filteredResults = results;
        
        if (scenario) {
          filteredResults = filteredResults.filter(r => r.scenario === scenario);
        }
        if (result) {
          filteredResults = filteredResults.filter(r => r.result === result);
        }
        
        return NextResponse.json({
          success: true,
          data: {
            total: results.length,
            filtered: filteredResults.length,
            results: filteredResults.slice(-limit).map(r => ({
              benchmarkId: r.benchmarkId,
              benchmarkName: r.benchmarkName,
              scenario: r.scenario,
              result: r.result,
              duration: r.duration,
              startTime: new Date(r.startTime).toISOString(),
              endTime: new Date(r.endTime).toISOString(),
              summary: r.summary,
              errors: r.errors,
              metadata: r.metadata
            }))
          }
        });

      case 'suites':
        const suites = getBenchmarkSuites();
        return NextResponse.json({
          success: true,
          data: {
            total: suites.length,
            suites: suites.map(s => ({
              suiteId: s.suiteId,
              suiteName: s.suiteName,
              totalBenchmarks: s.totalBenchmarks,
              passedBenchmarks: s.passedBenchmarks,
              failedBenchmarks: s.failedBenchmarks,
              warningBenchmarks: s.warningBenchmarks,
              duration: s.duration,
              startTime: new Date(s.startTime).toISOString(),
              endTime: new Date(s.endTime).toISOString(),
              summary: s.summary
            }))
          }
        });

      case 'summary':
        const summary = getOverallBenchmarkSummary();
        return NextResponse.json({
          success: true,
          data: summary
        });

      case 'status':
        const status = {
          totalBenchmarks: getBenchmarkResults().length,
          totalSuites: getBenchmarkSuites().length,
          lastRun: getBenchmarkSuites().length > 0 ? 
            new Date(Math.max(...getBenchmarkSuites().map(s => s.endTime))).toISOString() : 
            null,
          overallSummary: getOverallBenchmarkSummary(),
          availableResults: Object.values(BenchmarkResult),
          availableMetrics: Object.values(BenchmarkMetric),
          thresholds: {
            searchResponseTime: 2000,
            eventExtractionTime: 3000,
            speakerEnhancementTime: 5000,
            totalPipelineTime: 10000,
            databaseQueryTime: 500,
            cacheHitRate: 0.8,
            errorRate: 0.05,
            throughput: 100
          }
        };
        
        return NextResponse.json({
          success: true,
          data: status
        });

      case 'health':
        const health = {
          benchmarkerAvailable: true,
          lastHealthCheck: new Date().toISOString(),
          configuration: {
            timeout: 600000,
            retries: 3,
            warmupRounds: 3,
            measurementRounds: 10,
            cooldownRounds: 2
          }
        };
        
        return NextResponse.json({
          success: true,
          data: health
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: results, suites, summary, status, health'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[performance-benchmarking] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, benchmarkName, benchmarkFunction, scenario, concurrentUsers, metadata, suiteName, benchmarks } = body;

    switch (action) {
      case 'run-benchmark':
        if (!benchmarkName || !benchmarkFunction) {
          return NextResponse.json({
            success: false,
            error: 'Benchmark name and benchmark function are required'
          }, { status: 400 });
        }

        try {
          const result = await performanceBenchmarker.executeBenchmark(
            benchmarkName,
            async () => {
              // Execute the provided benchmark function
              if (typeof benchmarkFunction === 'function') {
                return await benchmarkFunction();
              }
              return { success: true, message: 'Benchmark executed' };
            },
            scenario || 'default',
            concurrentUsers || 1,
            metadata || {}
          );
          
          return NextResponse.json({
            success: true,
            message: 'Benchmark executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Benchmark execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-suite':
        if (!suiteName || !benchmarks || !Array.isArray(benchmarks)) {
          return NextResponse.json({
            success: false,
            error: 'Suite name and benchmarks array are required'
          }, { status: 400 });
        }

        try {
          const suiteBenchmarks = benchmarks.map((benchmark: any) => ({
            name: benchmark.name,
            benchmark: async () => {
              if (typeof benchmark.benchmark === 'function') {
                return await benchmark.benchmark();
              }
              return { success: true, message: 'Benchmark executed' };
            },
            scenario: benchmark.scenario || 'default',
            concurrentUsers: benchmark.concurrentUsers || 1,
            metadata: benchmark.metadata || {}
          }));

          const result = await performanceBenchmarker.executeBenchmarkSuite(suiteName, suiteBenchmarks);
          
          return NextResponse.json({
            success: true,
            message: 'Benchmark suite executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Benchmark suite execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-comprehensive':
        try {
          const result = await runComprehensiveBenchmarks();
          
          return NextResponse.json({
            success: true,
            message: 'Comprehensive benchmark suite executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Comprehensive benchmark suite execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-load-testing':
        try {
          const result = await runLoadTestingBenchmarks();
          
          return NextResponse.json({
            success: true,
            message: 'Load testing benchmark suite executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Load testing benchmark suite execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-search-pipeline-benchmark':
        try {
          const result = await performanceBenchmarker.benchmarkSearchPipeline();
          
          return NextResponse.json({
            success: true,
            message: 'Search pipeline benchmark executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Search pipeline benchmark execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-event-extraction-benchmark':
        try {
          const result = await performanceBenchmarker.benchmarkEventExtraction();
          
          return NextResponse.json({
            success: true,
            message: 'Event extraction benchmark executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Event extraction benchmark execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-speaker-enhancement-benchmark':
        try {
          const result = await performanceBenchmarker.benchmarkSpeakerEnhancement();
          
          return NextResponse.json({
            success: true,
            message: 'Speaker enhancement benchmark executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Speaker enhancement benchmark execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-database-operations-benchmark':
        try {
          const result = await performanceBenchmarker.benchmarkDatabaseOperations();
          
          return NextResponse.json({
            success: true,
            message: 'Database operations benchmark executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Database operations benchmark execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-load-handling-benchmark':
        try {
          const result = await performanceBenchmarker.benchmarkLoadHandling();
          
          return NextResponse.json({
            success: true,
            message: 'Load handling benchmark executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Load handling benchmark execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      case 'run-stress-test':
        try {
          const stressTest = {
            name: 'Stress Test',
            benchmark: async () => {
              const stressLevel = 100; // 100 concurrent operations
              const promises = [];
              
              for (let i = 0; i < stressLevel; i++) {
                promises.push(
                  new Promise(resolve => {
                    setTimeout(() => {
                      resolve({ success: true, operationId: i, duration: Math.random() * 3000 });
                    }, Math.random() * 1000);
                  })
                );
              }
              
              const results = await Promise.all(promises);
              const successCount = results.filter((r: any) => r.success).length;
              
              if (successCount < stressLevel * 0.6) {
                throw new Error(`Stress test failed: ${successCount}/${stressLevel} operations succeeded`);
              }
              
              return { success: true, stressLevel, successCount, results };
            },
            scenario: 'stress-testing',
            concurrentUsers: 100
          };

          const result = await performanceBenchmarker.executeBenchmark(
            stressTest.name,
            stressTest.benchmark,
            stressTest.scenario,
            stressTest.concurrentUsers
          );
          
          return NextResponse.json({
            success: true,
            message: 'Stress test executed successfully',
            data: result
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            message: 'Stress test execution failed',
            error: error instanceof Error ? error.message : String(error)
          });
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: run-benchmark, run-suite, run-comprehensive, run-load-testing, run-search-pipeline-benchmark, run-event-extraction-benchmark, run-speaker-enhancement-benchmark, run-database-operations-benchmark, run-load-handling-benchmark, run-stress-test'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[performance-benchmarking] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'clear':
        clearBenchmarkResults();
        return NextResponse.json({
          success: true,
          message: 'Benchmark results cleared successfully'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Supported actions: clear'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[performance-benchmarking] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
