/**
 * Test script for Market Intelligence API endpoints
 * 
 * This script tests all the Intelligence API endpoints to ensure they're working correctly
 */

const BASE_URL = 'http://localhost:4000';

// Test data
const testAccount = {
  company_name: 'Test Company Inc',
  domain: 'testcompany.com',
  industry: 'Technology',
  description: 'A test company for Market Intelligence testing',
  website_url: 'https://testcompany.com'
};

const testAccount2 = {
  company_name: 'Acme Corporation',
  domain: 'acme.com',
  industry: 'Manufacturing',
  description: 'Another test company for comprehensive testing',
  website_url: 'https://acme.com'
};

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  const data = await response.json();
  
  return {
    status: response.status,
    data,
    ok: response.ok
  };
}

// Test functions
async function testAccountCreation() {
  console.log('\n🧪 Testing Account Creation...');
  
  try {
    const result = await apiRequest('/api/intelligence/accounts', {
      method: 'POST',
      body: JSON.stringify(testAccount)
    });
    
    if (result.ok) {
      console.log('✅ Account creation successful');
      console.log('📊 Response:', JSON.stringify(result.data, null, 2));
      return result.data.account.id;
    } else {
      console.log('❌ Account creation failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Account creation error:', error.message);
    return null;
  }
}

async function testAccountListing() {
  console.log('\n🧪 Testing Account Listing...');
  
  try {
    const result = await apiRequest('/api/intelligence/accounts');
    
    if (result.ok) {
      console.log('✅ Account listing successful');
      console.log(`📊 Found ${result.data.accounts.length} accounts`);
      result.data.accounts.forEach((account, index) => {
        console.log(`   ${index + 1}. ${account.company_name} (${account.industry})`);
      });
      return result.data.accounts;
    } else {
      console.log('❌ Account listing failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return [];
    }
  } catch (error) {
    console.log('❌ Account listing error:', error.message);
    return [];
  }
}

async function testAccountDetails(accountId) {
  console.log('\n🧪 Testing Account Details...');
  
  try {
    const result = await apiRequest(`/api/intelligence/accounts/${accountId}`);
    
    if (result.ok) {
      console.log('✅ Account details successful');
      console.log('📊 Account:', JSON.stringify(result.data.account, null, 2));
      console.log('📊 Summary:', JSON.stringify(result.data.summary, null, 2));
      return result.data;
    } else {
      console.log('❌ Account details failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Account details error:', error.message);
    return null;
  }
}

async function testAccountAnalysis(accountId) {
  console.log('\n🧪 Testing Account Analysis...');
  
  try {
    const analysisRequest = {
      searchType: 'event_participation',
      timeRange: {
        from: '2024-01-01',
        to: '2024-12-31'
      },
      country: 'DE',
      maxResults: 10,
      forceRefresh: false
    };
    
    const result = await apiRequest(`/api/intelligence/accounts/${accountId}/analysis`, {
      method: 'POST',
      body: JSON.stringify(analysisRequest)
    });
    
    if (result.ok) {
      console.log('✅ Account analysis successful');
      console.log('📊 Analysis metadata:', JSON.stringify(result.data.metadata, null, 2));
      if (result.data.cached) {
        console.log('💾 Data served from cache');
      } else {
        console.log('🔄 Fresh analysis performed');
      }
      return result.data;
    } else {
      console.log('❌ Account analysis failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Account analysis error:', error.message);
    return null;
  }
}

async function testAccountSearch() {
  console.log('\n🧪 Testing Account Search...');
  
  try {
    const result = await apiRequest('/api/intelligence/accounts?search=Test&industry=Technology');
    
    if (result.ok) {
      console.log('✅ Account search successful');
      console.log(`📊 Found ${result.data.accounts.length} matching accounts`);
      result.data.accounts.forEach((account, index) => {
        console.log(`   ${index + 1}. ${account.company_name} (${account.industry})`);
      });
      return result.data.accounts;
    } else {
      console.log('❌ Account search failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return [];
    }
  } catch (error) {
    console.log('❌ Account search error:', error.message);
    return [];
  }
}

async function testAccountUpdate(accountId) {
  console.log('\n🧪 Testing Account Update...');
  
  try {
    const updateData = {
      description: 'Updated description for testing purposes',
      industry: 'Software'
    };
    
    const result = await apiRequest(`/api/intelligence/accounts/${accountId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    if (result.ok) {
      console.log('✅ Account update successful');
      console.log('📊 Updated account:', JSON.stringify(result.data.account, null, 2));
      return result.data.account;
    } else {
      console.log('❌ Account update failed');
      console.log('📊 Error:', JSON.stringify(result.data, null, 2));
      return null;
    }
  } catch (error) {
    console.log('❌ Account update error:', error.message);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Market Intelligence API Tests...');
  console.log('=' .repeat(50));
  
  // Test 1: Create accounts
  const accountId1 = await testAccountCreation();
  const accountId2 = await testAccountCreation();
  
  // Test 2: List accounts
  const accounts = await testAccountListing();
  
  // Test 3: Get account details
  if (accountId1) {
    await testAccountDetails(accountId1);
  }
  
  // Test 4: Search accounts
  await testAccountSearch();
  
  // Test 5: Update account
  if (accountId1) {
    await testAccountUpdate(accountId1);
  }
  
  // Test 6: Account analysis (if we have an account)
  if (accountId1) {
    await testAccountAnalysis(accountId1);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎉 API Testing Complete!');
  console.log(`📊 Total accounts created: ${accounts.length}`);
  
  if (accountId1) {
    console.log(`🔗 Test account ID: ${accountId1}`);
    console.log(`🌐 View in browser: http://localhost:3000/intelligence`);
  }
}

// Run the tests
runTests().catch(console.error);
