/**
 * Simple test script for Market Intelligence functionality
 * 
 * This script tests the core functionality without requiring authentication
 */

const BASE_URL = 'http://localhost:4000';

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
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
async function testBasicAPI() {
  console.log('\n🧪 Testing Basic API Connectivity...');
  
  try {
    const result = await apiRequest('/api/test/intelligence');
    
    if (result.ok) {
      console.log('✅ Basic API test successful');
      console.log('📊 Response:', JSON.stringify(result.data, null, 2));
      return true;
    } else {
      console.log('❌ Basic API test failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Basic API test error:', error.message);
    return false;
  }
}

async function testSearchFunctionality() {
  console.log('\n🧪 Testing Search Functionality...');
  
  try {
    const result = await apiRequest('/api/test/intelligence', {
      method: 'POST',
      body: JSON.stringify({
        testType: 'search',
        companyName: 'Microsoft'
      })
    });
    
    if (result.ok) {
      console.log('✅ Search functionality test successful');
      console.log('📊 Search Result:', JSON.stringify(result.data.result, null, 2));
      return true;
    } else {
      console.log('❌ Search functionality test failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Search functionality test error:', error.message);
    return false;
  }
}

async function testCacheFunctionality() {
  console.log('\n🧪 Testing Cache Functionality...');
  
  try {
    const result = await apiRequest('/api/test/intelligence', {
      method: 'POST',
      body: JSON.stringify({
        testType: 'cache',
        companyName: 'Google'
      })
    });
    
    if (result.ok) {
      console.log('✅ Cache functionality test successful');
      console.log('📊 Cache Result:', JSON.stringify(result.data.result, null, 2));
      return true;
    } else {
      console.log('❌ Cache functionality test failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Cache functionality test error:', error.message);
    return false;
  }
}

async function testAnalysisFunctionality() {
  console.log('\n🧪 Testing Analysis Functionality...');
  
  try {
    const result = await apiRequest('/api/test/intelligence', {
      method: 'POST',
      body: JSON.stringify({
        testType: 'analysis',
        companyName: 'Apple'
      })
    });
    
    if (result.ok) {
      console.log('✅ Analysis functionality test successful');
      console.log('📊 Analysis Result:', JSON.stringify(result.data.result, null, 2));
      return true;
    } else {
      console.log('❌ Analysis functionality test failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return false;
    }
  } catch (error) {
    console.log('❌ Analysis functionality test error:', error.message);
    return false;
  }
}

async function testUIEndpoint() {
  console.log('\n🧪 Testing UI Endpoint...');
  
  try {
    const result = await apiRequest('/intelligence');
    
    if (result.status === 200) {
      console.log('✅ UI endpoint accessible');
      console.log('📊 Status: 200 OK');
      return true;
    } else if (result.status === 401 || result.status === 403) {
      console.log('⚠️  UI endpoint requires authentication (expected)');
      console.log('📊 Status:', result.status);
      return true; // This is expected behavior
    } else {
      console.log('❌ UI endpoint test failed');
      console.log('📊 Status:', result.status);
      return false;
    }
  } catch (error) {
    console.log('❌ UI endpoint test error:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Market Intelligence Simple Tests...');
  console.log('=' .repeat(50));
  
  const results = {
    basicAPI: await testBasicAPI(),
    search: await testSearchFunctionality(),
    cache: await testCacheFunctionality(),
    analysis: await testAnalysisFunctionality(),
    ui: await testUIEndpoint()
  };
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎉 Simple Testing Complete!');
  console.log('\n📊 Test Results:');
  console.log(`   Basic API: ${results.basicAPI ? '✅' : '❌'}`);
  console.log(`   Search: ${results.search ? '✅' : '❌'}`);
  console.log(`   Cache: ${results.cache ? '✅' : '❌'}`);
  console.log(`   Analysis: ${results.analysis ? '✅' : '❌'}`);
  console.log(`   UI Endpoint: ${results.ui ? '✅' : '❌'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Market Intelligence is ready for use.');
    console.log('🌐 Access the dashboard at: http://localhost:4000/intelligence');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
}

// Run the tests
runTests().catch(console.error);
