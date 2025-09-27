/**
 * Performance Test Suites
 * 
 * This file provides comprehensive performance testing utilities
 * for the Attendry application.
 */

import { performanceMonitor, PerformanceUtils } from './performance-monitor';

/**
 * Performance test configuration
 */
interface PerformanceTestConfig {
  name: string;
  description: string;
  threshold: number; // milliseconds
  iterations: number;
  warmupIterations: number;
}

/**
 * Performance test result
 */
interface PerformanceTestResult {
  name: string;
  passed: boolean;
  averageTime: number;
  minTime: number;
  maxTime: number;
  threshold: number;
  iterations: number;
  details: string;
}

/**
 * Performance test suite
 */
export class PerformanceTestSuite {
  private results: PerformanceTestResult[] = [];
  private configs: Map<string, PerformanceTestConfig> = new Map();

  constructor() {
    this.setupDefaultTests();
  }

  /**
   * Setup default performance tests
   */
  private setupDefaultTests(): void {
    this.addTest({
      name: 'page_load',
      description: 'Page load performance',
      threshold: 2000, // 2 seconds
      iterations: 5,
      warmupIterations: 2,
    });

    this.addTest({
      name: 'api_response',
      description: 'API response time',
      threshold: 1000, // 1 second
      iterations: 10,
      warmupIterations: 3,
    });

    this.addTest({
      name: 'component_render',
      description: 'Component rendering performance',
      threshold: 100, // 100ms
      iterations: 20,
      warmupIterations: 5,
    });

    this.addTest({
      name: 'cache_operation',
      description: 'Cache operation performance',
      threshold: 50, // 50ms
      iterations: 50,
      warmupIterations: 10,
    });
  }

  /**
   * Add a performance test configuration
   */
  addTest(config: PerformanceTestConfig): void {
    this.configs.set(config.name, config);
  }

  /**
   * Run a specific performance test
   */
  async runTest(
    testName: string,
    testFunction: () => Promise<void> | void
  ): Promise<PerformanceTestResult> {
    const config = this.configs.get(testName);
    if (!config) {
      throw new Error(`Test configuration not found: ${testName}`);
    }

    const times: number[] = [];
    const { iterations, warmupIterations, threshold } = config;

    // Warmup iterations
    for (let i = 0; i < warmupIterations; i++) {
      await testFunction();
    }

    // Actual test iterations
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await testFunction();
      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    // Calculate statistics
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const passed = averageTime <= threshold;

    const result: PerformanceTestResult = {
      name: testName,
      passed,
      averageTime,
      minTime,
      maxTime,
      threshold,
      iterations,
      details: `${averageTime.toFixed(2)}ms average (${minTime.toFixed(2)}ms - ${maxTime.toFixed(2)}ms)`,
    };

    this.results.push(result);
    return result;
  }

  /**
   * Run all performance tests
   */
  async runAllTests(): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];

    for (const [testName, config] of this.configs.entries()) {
      try {
        const result = await this.runTest(testName, () => this.getDefaultTestFunction(testName));
        results.push(result);
      } catch (error) {
        results.push({
          name: testName,
          passed: false,
          averageTime: 0,
          minTime: 0,
          maxTime: 0,
          threshold: config.threshold,
          iterations: config.iterations,
          details: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return results;
  }

  /**
   * Get default test function for a test name
   */
  private getDefaultTestFunction(testName: string): () => Promise<void> | void {
    switch (testName) {
      case 'page_load':
        return () => this.testPageLoad();
      case 'api_response':
        return () => this.testApiResponse();
      case 'component_render':
        return () => this.testComponentRender();
      case 'cache_operation':
        return () => this.testCacheOperation();
      default:
        return () => Promise.resolve();
    }
  }

  /**
   * Test page load performance
   */
  private async testPageLoad(): Promise<void> {
    // Simulate page load by measuring DOM operations
    const startTime = performance.now();
    
    // Simulate DOM operations
    const div = document.createElement('div');
    div.innerHTML = '<p>Test content</p>';
    document.body.appendChild(div);
    document.body.removeChild(div);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    PerformanceUtils.record('page_load', {
      test: 'dom_operations',
      duration,
    });
  }

  /**
   * Test API response performance
   */
  private async testApiResponse(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Test a simple API call
      const response = await fetch('/api/health');
      await response.json();
    } catch (error) {
      // Ignore errors in tests
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    PerformanceUtils.record('api_response', {
      test: 'health_check',
      duration,
    });
  }

  /**
   * Test component render performance
   */
  private testComponentRender(): void {
    const startTime = performance.now();
    
    // Simulate component rendering
    const elements = [];
    for (let i = 0; i < 100; i++) {
      const div = document.createElement('div');
      div.textContent = `Element ${i}`;
      elements.push(div);
    }
    
    // Simulate DOM manipulation
    const container = document.createElement('div');
    elements.forEach(el => container.appendChild(el));
    document.body.appendChild(container);
    document.body.removeChild(container);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    PerformanceUtils.record('component_render', {
      test: 'dom_manipulation',
      duration,
    });
  }

  /**
   * Test cache operation performance
   */
  private async testCacheOperation(): Promise<void> {
    const startTime = performance.now();
    
    // Simulate cache operations
    const cache = new Map();
    for (let i = 0; i < 100; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    
    for (let i = 0; i < 100; i++) {
      cache.get(`key${i}`);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    PerformanceUtils.record('cache_operation', {
      test: 'map_operations',
      duration,
    });
  }

  /**
   * Get test results
   */
  getResults(): PerformanceTestResult[] {
    return [...this.results];
  }

  /**
   * Get test summary
   */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    averageTime: number;
    slowestTest: PerformanceTestResult | null;
    fastestTest: PerformanceTestResult | null;
  } {
    const results = this.results;
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    const averageTime = results.reduce((sum, r) => sum + r.averageTime, 0) / total;
    const slowestTest = results.reduce((slowest, current) => 
      current.averageTime > slowest.averageTime ? current : slowest, results[0] || null);
    const fastestTest = results.reduce((fastest, current) => 
      current.averageTime < fastest.averageTime ? current : fastest, results[0] || null);

    return {
      total,
      passed,
      failed,
      averageTime,
      slowestTest,
      fastestTest,
    };
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const summary = this.getSummary();
    const results = this.results;

    let report = `# Performance Test Report\n\n`;
    report += `## Summary\n`;
    report += `- Total Tests: ${summary.total}\n`;
    report += `- Passed: ${summary.passed}\n`;
    report += `- Failed: ${summary.failed}\n`;
    report += `- Average Time: ${summary.averageTime.toFixed(2)}ms\n\n`;

    if (summary.slowestTest) {
      report += `- Slowest Test: ${summary.slowestTest.name} (${summary.slowestTest.averageTime.toFixed(2)}ms)\n`;
    }
    if (summary.fastestTest) {
      report += `- Fastest Test: ${summary.fastestTest.name} (${summary.fastestTest.averageTime.toFixed(2)}ms)\n`;
    }

    report += `\n## Test Results\n\n`;
    results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      report += `### ${result.name} - ${status}\n`;
      report += `- Average Time: ${result.averageTime.toFixed(2)}ms\n`;
      report += `- Threshold: ${result.threshold}ms\n`;
      report += `- Range: ${result.minTime.toFixed(2)}ms - ${result.maxTime.toFixed(2)}ms\n`;
      report += `- Iterations: ${result.iterations}\n`;
      report += `- Details: ${result.details}\n\n`;
    });

    return report;
  }
}

/**
 * Global performance test suite instance
 */
export const performanceTestSuite = new PerformanceTestSuite();

/**
 * Utility functions for easy access
 */
export const PerformanceTestUtils = {
  /**
   * Run a specific test
   */
  runTest: async (testName: string, testFunction: () => Promise<void> | void) => {
    return performanceTestSuite.runTest(testName, testFunction);
  },

  /**
   * Run all tests
   */
  runAllTests: async () => {
    return performanceTestSuite.runAllTests();
  },

  /**
   * Get test results
   */
  getResults: () => {
    return performanceTestSuite.getResults();
  },

  /**
   * Get test summary
   */
  getSummary: () => {
    return performanceTestSuite.getSummary();
  },

  /**
   * Generate and log report
   */
  logReport: () => {
    const report = performanceTestSuite.generateReport();
    console.log(report);
    return report;
  },

  /**
   * Run performance tests and log results
   */
  runAndLog: async () => {
    console.log('🚀 Running performance tests...');
    const results = await performanceTestSuite.runAllTests();
    const summary = performanceTestSuite.getSummary();
    
    console.group('📊 Performance Test Results');
    console.log(`Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`);
    console.log(`Average Time: ${summary.averageTime.toFixed(2)}ms`);
    
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}: ${result.averageTime.toFixed(2)}ms (threshold: ${result.threshold}ms)`);
    });
    
    console.groupEnd();
    
    return results;
  },
};
