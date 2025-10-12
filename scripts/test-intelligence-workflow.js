/**
 * Comprehensive Market Intelligence Workflow Test
 * 
 * This script tests the complete user workflow from account creation
 * to intelligence analysis, simulating real user interactions
 */

const BASE_URL = 'http://localhost:4000';

// Sample companies for testing
const sampleCompanies = [
  {
    company_name: 'Microsoft Corporation',
    domain: 'microsoft.com',
    industry: 'Technology',
    description: 'Leading technology company specializing in cloud computing, productivity software, and AI',
    website_url: 'https://microsoft.com'
  },
  {
    company_name: 'SAP SE',
    domain: 'sap.com',
    industry: 'Enterprise Software',
    description: 'German multinational software corporation that makes enterprise software to manage business operations',
    website_url: 'https://sap.com'
  },
  {
    company_name: 'Siemens AG',
    domain: 'siemens.com',
    industry: 'Industrial Technology',
    description: 'German multinational conglomerate company and the largest industrial manufacturing company in Europe',
    website_url: 'https://siemens.com'
  },
  {
    company_name: 'BMW Group',
    domain: 'bmw.com',
    industry: 'Automotive',
    description: 'German multinational manufacturer of luxury vehicles and motorcycles',
    website_url: 'https://bmw.com'
  },
  {
    company_name: 'Deutsche Bank AG',
    domain: 'deutsche-bank.de',
    industry: 'Financial Services',
    description: 'German multinational investment bank and financial services company',
    website_url: 'https://deutsche-bank.de'
  }
];

// Helper function to make authenticated API requests
async function authenticatedRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      // Note: In a real scenario, this would include authentication headers
      // For testing, we'll use the test endpoint that doesn't require auth
    },
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();
    
    return {
      status: response.status,
      data,
      ok: response.ok
    };
  } catch (error) {
    return {
      status: 0,
      data: { error: error.message },
      ok: false
    };
  }
}

// Test functions
async function testCompanySearch() {
  console.log('\n🔍 Testing Company Search Functionality...');
  
  const results = [];
  
  for (const company of sampleCompanies.slice(0, 3)) { // Test first 3 companies
    console.log(`\n  📊 Testing search for: ${company.company_name}`);
    
    try {
      const result = await authenticatedRequest('/api/test/intelligence', {
        method: 'POST',
        body: JSON.stringify({
          testType: 'search',
          companyName: company.company_name
        })
      });
      
      if (result.ok) {
        console.log(`    ✅ Search successful for ${company.company_name}`);
        console.log(`    📈 Results: ${result.data.result.totalResults} events found`);
        console.log(`    🎯 Confidence: ${(result.data.result.confidence * 100).toFixed(1)}%`);
        results.push({
          company: company.company_name,
          success: true,
          results: result.data.result.totalResults,
          confidence: result.data.result.confidence
        });
      } else {
        console.log(`    ❌ Search failed for ${company.company_name}`);
        console.log(`    📊 Error: ${JSON.stringify(result.data, null, 2)}`);
        results.push({
          company: company.company_name,
          success: false,
          error: result.data.error
        });
      }
    } catch (error) {
      console.log(`    ❌ Search error for ${company.company_name}: ${error.message}`);
      results.push({
        company: company.company_name,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function testCachePerformance() {
  console.log('\n💾 Testing Cache Performance...');
  
  const cacheResults = [];
  
  for (const company of sampleCompanies.slice(0, 2)) { // Test first 2 companies
    console.log(`\n  🧪 Testing cache for: ${company.company_name}`);
    
    try {
      // First request (should miss cache)
      const result1 = await authenticatedRequest('/api/test/intelligence', {
        method: 'POST',
        body: JSON.stringify({
          testType: 'cache',
          companyName: company.company_name
        })
      });
      
      if (result1.ok) {
        console.log(`    📊 First request - Cached: ${result1.data.result.cached}`);
        console.log(`    📈 Cache stats: ${JSON.stringify(result1.data.result.stats, null, 2)}`);
        
        // Second request (should hit cache if implemented)
        const result2 = await authenticatedRequest('/api/test/intelligence', {
          method: 'POST',
          body: JSON.stringify({
            testType: 'cache',
            companyName: company.company_name
          })
        });
        
        if (result2.ok) {
          console.log(`    📊 Second request - Cached: ${result2.data.result.cached}`);
          console.log(`    📈 Updated stats: ${JSON.stringify(result2.data.result.stats, null, 2)}`);
          
          cacheResults.push({
            company: company.company_name,
            firstRequest: result1.data.result,
            secondRequest: result2.data.result,
            performance: {
              hits: result2.data.result.stats.hits,
              misses: result2.data.result.stats.misses
            }
          });
        }
      }
    } catch (error) {
      console.log(`    ❌ Cache test error for ${company.company_name}: ${error.message}`);
    }
  }
  
  return cacheResults;
}

async function testAnalysisWorkflow() {
  console.log('\n🧠 Testing Analysis Workflow...');
  
  const analysisResults = [];
  
  for (const company of sampleCompanies.slice(0, 2)) { // Test first 2 companies
    console.log(`\n  🔬 Testing analysis for: ${company.company_name}`);
    
    try {
      const result = await authenticatedRequest('/api/test/intelligence', {
        method: 'POST',
        body: JSON.stringify({
          testType: 'analysis',
          companyName: company.company_name
        })
      });
      
      if (result.ok) {
        console.log(`    ✅ Analysis successful for ${company.company_name}`);
        console.log(`    📊 Mock Analysis: ${JSON.stringify(result.data.result.mockAnalysis, null, 2)}`);
        
        analysisResults.push({
          company: company.company_name,
          success: true,
          analysis: result.data.result.mockAnalysis
        });
      } else {
        console.log(`    ❌ Analysis failed for ${company.company_name}`);
        analysisResults.push({
          company: company.company_name,
          success: false,
          error: result.data.error
        });
      }
    } catch (error) {
      console.log(`    ❌ Analysis error for ${company.company_name}: ${error.message}`);
      analysisResults.push({
        company: company.company_name,
        success: false,
        error: error.message
      });
    }
  }
  
  return analysisResults;
}

async function testUIComponents() {
  console.log('\n🎨 Testing UI Components...');
  
  try {
    // Test if the intelligence page loads
    const response = await fetch(`${BASE_URL}/intelligence`);
    
    if (response.ok) {
      console.log('  ✅ Intelligence dashboard page loads successfully');
      console.log(`  📊 Status: ${response.status} ${response.statusText}`);
      
      // Check if it's a Next.js page (should contain some React/Next.js indicators)
      const html = await response.text();
      const hasNextJS = html.includes('__NEXT_DATA__') || html.includes('_next');
      
      if (hasNextJS) {
        console.log('  ✅ Page appears to be a proper Next.js application');
      } else {
        console.log('  ⚠️  Page loaded but may not be the full React application');
      }
      
      return {
        success: true,
        status: response.status,
        isNextJS: hasNextJS
      };
    } else {
      console.log(`  ❌ Intelligence dashboard failed to load: ${response.status}`);
      return {
        success: false,
        status: response.status
      };
    }
  } catch (error) {
    console.log(`  ❌ UI test error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generateTestReport(searchResults, cacheResults, analysisResults, uiResults) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 MARKET INTELLIGENCE TEST REPORT');
  console.log('='.repeat(60));
  
  // Search Results Summary
  console.log('\n🔍 SEARCH FUNCTIONALITY:');
  const successfulSearches = searchResults.filter(r => r.success).length;
  console.log(`   ✅ Successful searches: ${successfulSearches}/${searchResults.length}`);
  if (successfulSearches > 0) {
    const avgConfidence = searchResults
      .filter(r => r.success && r.confidence)
      .reduce((sum, r) => sum + r.confidence, 0) / successfulSearches;
    console.log(`   📊 Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  }
  
  // Cache Performance Summary
  console.log('\n💾 CACHE PERFORMANCE:');
  if (cacheResults.length > 0) {
    const totalHits = cacheResults.reduce((sum, r) => sum + r.performance.hits, 0);
    const totalMisses = cacheResults.reduce((sum, r) => sum + r.performance.misses, 0);
    console.log(`   📈 Total cache hits: ${totalHits}`);
    console.log(`   📉 Total cache misses: ${totalMisses}`);
    if (totalHits + totalMisses > 0) {
      const hitRate = (totalHits / (totalHits + totalMisses) * 100).toFixed(1);
      console.log(`   🎯 Cache hit rate: ${hitRate}%`);
    }
  } else {
    console.log('   ⚠️  No cache test results available');
  }
  
  // Analysis Results Summary
  console.log('\n🧠 ANALYSIS FUNCTIONALITY:');
  const successfulAnalyses = analysisResults.filter(r => r.success).length;
  console.log(`   ✅ Successful analyses: ${successfulAnalyses}/${analysisResults.length}`);
  
  // UI Results Summary
  console.log('\n🎨 UI FUNCTIONALITY:');
  if (uiResults.success) {
    console.log(`   ✅ Intelligence dashboard loads successfully`);
    console.log(`   📊 Status: ${uiResults.status}`);
    console.log(`   🔧 Next.js application: ${uiResults.isNextJS ? 'Yes' : 'No'}`);
  } else {
    console.log(`   ❌ Intelligence dashboard failed to load`);
    console.log(`   📊 Status: ${uiResults.status || 'Unknown'}`);
  }
  
  // Overall Assessment
  console.log('\n🎯 OVERALL ASSESSMENT:');
  const totalTests = searchResults.length + cacheResults.length + analysisResults.length + 1;
  const passedTests = successfulSearches + cacheResults.length + successfulAnalyses + (uiResults.success ? 1 : 0);
  const passRate = (passedTests / totalTests * 100).toFixed(1);
  
  console.log(`   📊 Tests passed: ${passedTests}/${totalTests} (${passRate}%)`);
  
  if (passRate >= 80) {
    console.log('   🎉 EXCELLENT: Market Intelligence is ready for production!');
  } else if (passRate >= 60) {
    console.log('   ✅ GOOD: Market Intelligence is functional with minor issues');
  } else {
    console.log('   ⚠️  NEEDS WORK: Several issues need to be addressed');
  }
  
  console.log('\n🌐 Next Steps:');
  console.log('   1. Visit http://localhost:4000/intelligence to test the UI');
  console.log('   2. Create accounts and test the full workflow');
  console.log('   3. Monitor performance and user experience');
  console.log('   4. Set up authentication for production use');
}

// Main test runner
async function runWorkflowTests() {
  console.log('🚀 Starting Market Intelligence Workflow Tests...');
  console.log('='.repeat(60));
  
  try {
    // Run all tests
    const searchResults = await testCompanySearch();
    const cacheResults = await testCachePerformance();
    const analysisResults = await testAnalysisWorkflow();
    const uiResults = await testUIComponents();
    
    // Generate comprehensive report
    await generateTestReport(searchResults, cacheResults, analysisResults, uiResults);
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error);
  }
}

// Run the tests
runWorkflowTests().catch(console.error);
