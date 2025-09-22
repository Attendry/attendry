#!/usr/bin/env node

/**
 * Test script to verify cron job setup
 * Run this after deploying to Vercel to test your cron configuration
 */

const https = require('https');

// Configuration - Update these values
const CONFIG = {
  domain: 'your-domain.vercel.app', // Replace with your actual Vercel domain
  cronSecret: 'your-cron-secret-here', // Replace with your actual CRON_SECRET
};

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function testCronSetup() {
  console.log('🧪 Testing Vercel Cron Job Setup\n');
  
  const baseUrl = `https://${CONFIG.domain}`;
  
  // Test 1: Check if the cron endpoint is accessible
  console.log('1️⃣ Testing cron endpoint accessibility...');
  try {
    const response = await makeRequest(`${baseUrl}/api/cron/collect-events`);
    if (response.status === 200) {
      console.log('✅ Cron endpoint is accessible');
      console.log(`   Status: ${response.data.status || 'unknown'}`);
    } else {
      console.log(`❌ Cron endpoint returned status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Failed to reach cron endpoint: ${error.message}`);
  }
  
  // Test 2: Test manual cron execution
  console.log('\n2️⃣ Testing manual cron execution...');
  try {
    const response = await makeRequest(`${baseUrl}/api/cron/collect-events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.cronSecret}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Manual cron execution successful');
      console.log(`   Collection type: ${response.data.collectionType || 'standard'}`);
      console.log(`   Total jobs: ${response.data.summary?.totalJobs || 0}`);
      console.log(`   Successful jobs: ${response.data.summary?.successfulJobs || 0}`);
      console.log(`   Events collected: ${response.data.summary?.totalEventsCollected || 0}`);
    } else {
      console.log(`❌ Manual cron execution failed: ${response.status}`);
      console.log(`   Error: ${response.data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.log(`❌ Failed to execute cron job: ${error.message}`);
  }
  
  // Test 3: Check database connectivity
  console.log('\n3️⃣ Testing database connectivity...');
  try {
    const response = await makeRequest(`${baseUrl}/api/events/collect?industry=legal-compliance&country=de`);
    if (response.status === 200) {
      console.log('✅ Database connectivity confirmed');
      console.log(`   Event count: ${response.data.eventCount || 0}`);
    } else {
      console.log(`❌ Database connectivity issue: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Failed to check database: ${error.message}`);
  }
  
  // Test 4: Check health endpoint
  console.log('\n4️⃣ Testing health endpoint...');
  try {
    const response = await makeRequest(`${baseUrl}/api/health`);
    if (response.status === 200) {
      console.log('✅ Health endpoint responding');
    } else {
      console.log(`❌ Health endpoint issue: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Failed to check health: ${error.message}`);
  }
  
  console.log('\n🎉 Setup verification complete!');
  console.log('\nNext steps:');
  console.log('1. Wait for the next scheduled cron run (2 AM UTC daily)');
  console.log('2. Check Vercel function logs for execution details');
  console.log('3. Verify events are being stored in your Supabase database');
  console.log('4. Test user search performance improvements');
}

// Run the test
if (require.main === module) {
  if (CONFIG.domain === 'your-domain.vercel.app' || CONFIG.cronSecret === 'your-cron-secret-here') {
    console.log('❌ Please update the CONFIG object with your actual domain and cron secret');
    console.log('   Edit the CONFIG object in this file before running the test');
    process.exit(1);
  }
  
  testCronSetup().catch(console.error);
}

module.exports = { testCronSetup };
