#!/usr/bin/env node

/**
 * Performance Test Runner
 * 
 * This script runs performance tests and generates reports
 * for the Attendry application.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Performance test configuration
 */
const config = {
  outputDir: path.join(__dirname, '../performance-reports'),
  reportFormat: 'json', // json, html, markdown
  includeScreenshots: false,
  testTimeout: 30000, // 30 seconds
};

/**
 * Create output directory if it doesn't exist
 */
function ensureOutputDir() {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
}

/**
 * Run performance tests
 */
async function runPerformanceTests() {
  console.log('🚀 Starting performance tests...');
  
  try {
    // Build the application
    console.log('📦 Building application...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Start the application
    console.log('🌐 Starting application...');
    const serverProcess = execSync('npm run start', { 
      stdio: 'pipe',
      detached: true 
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run performance tests
    console.log('🧪 Running performance tests...');
    const testResults = await runTests();
    
    // Generate reports
    console.log('📊 Generating reports...');
    await generateReports(testResults);
    
    // Cleanup
    process.kill(-serverProcess.pid);
    
    console.log('✅ Performance tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Performance tests failed:', error.message);
    process.exit(1);
  }
}

/**
 * Run actual performance tests
 */
async function runTests() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      averageTime: 0,
    },
  };
  
  // Test configurations
  const tests = [
    {
      name: 'page_load',
      url: 'http://localhost:3000',
      threshold: 2000,
    },
    {
      name: 'events_page',
      url: 'http://localhost:3000/events',
      threshold: 3000,
    },
    {
      name: 'api_health',
      url: 'http://localhost:3000/api/health',
      threshold: 500,
    },
    {
      name: 'api_events_search',
      url: 'http://localhost:3000/api/events/search',
      threshold: 2000,
      method: 'POST',
      body: JSON.stringify({
        q: 'legal conference',
        country: 'de',
        from: '2024-01-01',
        to: '2024-12-31',
      }),
    },
  ];
  
  for (const test of tests) {
    console.log(`Running test: ${test.name}`);
    
    try {
      const result = await runSingleTest(test);
      results.tests.push(result);
      results.summary.total++;
      
      if (result.passed) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
      
      results.summary.averageTime += result.averageTime;
      
    } catch (error) {
      console.error(`Test ${test.name} failed:`, error.message);
      results.tests.push({
        name: test.name,
        passed: false,
        error: error.message,
        averageTime: 0,
        minTime: 0,
        maxTime: 0,
        threshold: test.threshold,
      });
      results.summary.total++;
      results.summary.failed++;
    }
  }
  
  results.summary.averageTime /= results.summary.total;
  
  return results;
}

/**
 * Run a single performance test
 */
async function runSingleTest(test) {
  const iterations = 5;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(test.url, {
        method: test.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: test.body,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      await response.text();
      
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
    
    const endTime = Date.now();
    times.push(endTime - startTime);
    
    // Wait between iterations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const passed = averageTime <= test.threshold;
  
  return {
    name: test.name,
    passed,
    averageTime,
    minTime,
    maxTime,
    threshold: test.threshold,
    iterations,
    times,
  };
}

/**
 * Generate performance reports
 */
async function generateReports(results) {
  ensureOutputDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Generate JSON report
  const jsonReport = JSON.stringify(results, null, 2);
  fs.writeFileSync(
    path.join(config.outputDir, `performance-report-${timestamp}.json`),
    jsonReport
  );
  
  // Generate Markdown report
  const markdownReport = generateMarkdownReport(results);
  fs.writeFileSync(
    path.join(config.outputDir, `performance-report-${timestamp}.md`),
    markdownReport
  );
  
  // Generate HTML report
  const htmlReport = generateHtmlReport(results);
  fs.writeFileSync(
    path.join(config.outputDir, `performance-report-${timestamp}.html`),
    htmlReport
  );
  
  console.log(`📄 Reports generated in ${config.outputDir}`);
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(results) {
  let report = `# Performance Test Report\n\n`;
  report += `**Generated:** ${results.timestamp}\n\n`;
  
  report += `## Summary\n\n`;
  report += `- **Total Tests:** ${results.summary.total}\n`;
  report += `- **Passed:** ${results.summary.passed}\n`;
  report += `- **Failed:** ${results.summary.failed}\n`;
  report += `- **Average Time:** ${results.summary.averageTime.toFixed(2)}ms\n\n`;
  
  report += `## Test Results\n\n`;
  results.tests.forEach(test => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    report += `### ${test.name} - ${status}\n\n`;
    report += `- **Average Time:** ${test.averageTime.toFixed(2)}ms\n`;
    report += `- **Threshold:** ${test.threshold}ms\n`;
    report += `- **Range:** ${test.minTime.toFixed(2)}ms - ${test.maxTime.toFixed(2)}ms\n`;
    report += `- **Iterations:** ${test.iterations || 'N/A'}\n`;
    
    if (test.error) {
      report += `- **Error:** ${test.error}\n`;
    }
    
    report += `\n`;
  });
  
  return report;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(results) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .test-result { background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .test-result.passed { border-left: 4px solid #28a745; }
        .test-result.failed { border-left: 4px solid #dc3545; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .test-name { font-size: 1.2em; font-weight: bold; }
        .test-status { padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .test-status.passed { background: #d4edda; color: #155724; }
        .test-status.failed { background: #f8d7da; color: #721c24; }
        .test-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .detail-item { text-align: center; }
        .detail-label { font-size: 0.9em; color: #666; margin-bottom: 5px; }
        .detail-value { font-size: 1.1em; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p>Generated: ${results.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="summary-card">
            <h3>Total Tests</h3>
            <div class="value">${results.summary.total}</div>
        </div>
        <div class="summary-card">
            <h3>Passed</h3>
            <div class="value passed">${results.summary.passed}</div>
        </div>
        <div class="summary-card">
            <h3>Failed</h3>
            <div class="value failed">${results.summary.failed}</div>
        </div>
        <div class="summary-card">
            <h3>Average Time</h3>
            <div class="value">${results.summary.averageTime.toFixed(2)}ms</div>
        </div>
    </div>
    
    <h2>Test Results</h2>`;
  
  results.tests.forEach(test => {
    const statusClass = test.passed ? 'passed' : 'failed';
    const statusText = test.passed ? 'PASS' : 'FAIL';
    
    html += `
    <div class="test-result ${statusClass}">
        <div class="test-header">
            <div class="test-name">${test.name}</div>
            <div class="test-status ${statusClass}">${statusText}</div>
        </div>
        <div class="test-details">
            <div class="detail-item">
                <div class="detail-label">Average Time</div>
                <div class="detail-value">${test.averageTime.toFixed(2)}ms</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Threshold</div>
                <div class="detail-value">${test.threshold}ms</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Min Time</div>
                <div class="detail-value">${test.minTime.toFixed(2)}ms</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Max Time</div>
                <div class="detail-value">${test.maxTime.toFixed(2)}ms</div>
            </div>
            ${test.iterations ? `
            <div class="detail-item">
                <div class="detail-label">Iterations</div>
                <div class="detail-value">${test.iterations}</div>
            </div>
            ` : ''}
        </div>
        ${test.error ? `<p style="color: #dc3545; margin-top: 15px;"><strong>Error:</strong> ${test.error}</p>` : ''}
    </div>`;
  });
  
  html += `
</body>
</html>`;
  
  return html;
}

/**
 * Main execution
 */
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = {
  runPerformanceTests,
  generateReports,
  generateMarkdownReport,
  generateHtmlReport,
};
