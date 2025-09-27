#!/usr/bin/env node

/**
 * Test Debug Endpoint Script
 * 
 * Tests the debug endpoint to verify acceptance criteria.
 */

const https = require('https');
const http = require('http');

async function testDebugEndpoint(baseUrl) {
  console.log(`Testing debug endpoint at: ${baseUrl}/api/debug/test-search`);
  
  try {
    const response = await fetch(`${baseUrl}/api/debug/test-search`);
    const data = await response.json();
    
    console.log('\n=== Debug Endpoint Test Results ===');
    console.log(`Status: ${response.status}`);
    console.log(`Items returned: ${data.items?.length || 0}`);
    console.log(`Fallback used: ${data.fallbackUsed || false}`);
    console.log(`Trace marker: ${data.trace?.marker || 'N/A'}`);
    
    // Check acceptance criteria
    const criteria = {
      hasItems: (data.items?.length || 0) >= 5,
      hasTrace: !!data.trace,
      hasFlags: !!data.flags,
      neverEmpty: (data.items?.length || 0) > 0 || (data.items_fallback?.length || 0) > 0
    };
    
    console.log('\n=== Acceptance Criteria ===');
    console.log(`✅ Items >= 5: ${criteria.hasItems ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Has trace: ${criteria.hasTrace ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Has flags: ${criteria.hasFlags ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Never empty: ${criteria.neverEmpty ? 'PASS' : 'FAIL'}`);
    
    if (data.trace) {
      console.log('\n=== Trace Details ===');
      console.log(`Queries executed: ${data.trace.queries?.length || 0}`);
      console.log(`URLs seen: ${data.trace.results?.urlsSeen || 0}`);
      console.log(`URLs kept: ${data.trace.results?.urlsKept || 0}`);
      console.log(`Prioritization bypassed: ${data.trace.prioritization?.bypassed || false}`);
      console.log(`Extraction timeouts: ${data.trace.extract?.timedOut || 0}`);
      console.log(`Fallbacks used: ${data.trace.fallbacks?.used || false}`);
    }
    
    if (data.flags) {
      console.log('\n=== Flags Status ===');
      console.log(`Bypass Gemini: ${data.flags.BYPASS_GEMINI_JSON_STRICT}`);
      console.log(`Allow Undated: ${data.flags.ALLOW_UNDATED}`);
      console.log(`Relax Country: ${data.flags.RELAX_COUNTRY}`);
      console.log(`Relax Date: ${data.flags.RELAX_DATE}`);
      console.log(`Enable Curation: ${data.flags.ENABLE_CURATION_TIER}`);
    }
    
    const allPassed = Object.values(criteria).every(Boolean);
    console.log(`\n=== Overall Result: ${allPassed ? 'PASS' : 'FAIL'} ===`);
    
    return allPassed;
    
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  }
}

async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:4000';
  
  console.log('🧪 Testing Debug Endpoint');
  console.log('========================');
  
  const passed = await testDebugEndpoint(baseUrl);
  
  if (passed) {
    console.log('\n🎉 All acceptance criteria passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some acceptance criteria failed!');
    process.exit(1);
  }
}

// Polyfill fetch for Node.js < 18
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

main().catch(console.error);
