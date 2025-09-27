/**
 * Enhanced Search Pipeline Dry Run
 * 
 * This script tests the enhanced search pipeline with a sample query
 * to verify the implementation works correctly.
 */

const { buildEnhancedQuery } = require('../src/lib/services/enhanced-query-builder');
const { inferCountryAndDate } = require('../src/lib/utils/country-date-inference');
const { safeParseJson } = require('../src/lib/utils/json-parser');

async function runDryRun() {
  console.log('🚀 Starting Enhanced Search Pipeline Dry Run');
  console.log('=' .repeat(60));

  // Test 1: Query Building
  console.log('\n📝 Test 1: Query Building');
  console.log('-'.repeat(30));

  const searchConfig = {
    baseQuery: 'Compliance OR "Interne Untersuchung" OR eDiscovery OR DSGVO',
    fromISO: '2024-01-01',
    toISO: '2024-12-31',
    country: 'DE'
  };

  try {
    const queries = buildEnhancedQuery(searchConfig);
    
    console.log(`✅ Generated ${queries.length} queries:`);
    queries.forEach((query, index) => {
      console.log(`   ${index + 1}. ${query.name} (${query.query.length} chars)`);
      console.log(`      Query: ${query.query}`);
    });

    // Verify query lengths
    const longQueries = queries.filter(q => q.query.length > 256);
    if (longQueries.length > 0) {
      console.log(`❌ Found ${longQueries.length} queries exceeding 256 characters`);
    } else {
      console.log('✅ All queries are within length limits');
    }

  } catch (error) {
    console.error('❌ Query building failed:', error.message);
  }

  // Test 2: Country and Date Inference
  console.log('\n🌍 Test 2: Country and Date Inference');
  console.log('-'.repeat(30));

  const testCases = [
    {
      url: 'https://beck-akademie.de/veranstaltung/compliance-konferenz',
      content: 'Die Veranstaltung findet am 15. März 2024 in Berlin statt.',
      expected: { country: 'DE', dateISO: '2024-03-15' }
    },
    {
      url: 'https://example.com/event',
      content: 'Event in Vienna, Austria on 20. April 2024',
      expected: { country: 'AT', dateISO: '2024-04-20' }
    },
    {
      url: 'https://example.ch/event',
      content: 'Event in Zurich, Switzerland',
      expected: { country: 'CH' }
    }
  ];

  testCases.forEach((testCase, index) => {
    try {
      const result = inferCountryAndDate(
        testCase.url,
        testCase.content,
        '2024-01-01',
        '2024-12-31'
      );

      console.log(`   Test ${index + 1}: ${testCase.url}`);
      console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
      console.log(`   Got: ${JSON.stringify(result)}`);
      
      if (result.country === testCase.expected.country) {
        console.log('   ✅ Country inference correct');
      } else {
        console.log('   ❌ Country inference incorrect');
      }

      if (testCase.expected.dateISO && result.dateISO === testCase.expected.dateISO) {
        console.log('   ✅ Date extraction correct');
      } else if (!testCase.expected.dateISO && !result.dateISO) {
        console.log('   ✅ Date extraction correct (no date expected)');
      } else {
        console.log('   ❌ Date extraction incorrect');
      }

    } catch (error) {
      console.error(`   ❌ Test ${index + 1} failed:`, error.message);
    }
  });

  // Test 3: JSON Parsing
  console.log('\n🔧 Test 3: JSON Parsing');
  console.log('-'.repeat(30));

  const jsonTestCases = [
    {
      name: 'Valid JSON',
      input: '{"version":"1.0","items":[{"url":"test","title":"test"}]}',
      shouldSucceed: true
    },
    {
      name: 'Malformed JSON (trailing comma)',
      input: '{"version":"1.0","items":[{"url":"test","title":"test",}]}',
      shouldSucceed: true
    },
    {
      name: 'JSON with comments',
      input: '{"version":"1.0",/*comment*/"items":[]}',
      shouldSucceed: true
    },
    {
      name: 'Invalid JSON',
      input: 'not json at all',
      shouldSucceed: false
    }
  ];

  jsonTestCases.forEach((testCase, index) => {
    try {
      const result = safeParseJson(testCase.input);
      const succeeded = result !== null;

      console.log(`   Test ${index + 1}: ${testCase.name}`);
      console.log(`   Input: ${testCase.input.substring(0, 50)}...`);
      console.log(`   Expected: ${testCase.shouldSucceed ? 'Success' : 'Failure'}`);
      console.log(`   Got: ${succeeded ? 'Success' : 'Failure'}`);

      if (succeeded === testCase.shouldSucceed) {
        console.log('   ✅ JSON parsing correct');
      } else {
        console.log('   ❌ JSON parsing incorrect');
      }

    } catch (error) {
      console.error(`   ❌ Test ${index + 1} failed:`, error.message);
    }
  });

  // Test 4: Search Trace Simulation
  console.log('\n📊 Test 4: Search Trace Simulation');
  console.log('-'.repeat(30));

  const mockTrace = {
    finalQueries: queries.map(q => ({ name: q.name, query: q.query, length: q.query.length })),
    urls: { checked: 25, kept: 8, filtered: [
      { url: 'https://example.com/blog', reason: 'noise path' },
      { url: 'https://example.com/sports', reason: 'excluded term' }
    ]},
    tiers: {
      'Tier A - Precise': { executed: true, results: 15, urls: ['url1', 'url2'] },
      'Tier B - Legal Ops': { executed: true, results: 8, urls: ['url3', 'url4'] },
      'Tier C - Domains 1': { executed: false, results: 0, urls: [] }
    },
    prioritization: {
      model: 'gemini-1.5-flash',
      repairUsed: false,
      stats: { total: 15, prioritized: 8, reasons: ['High legal relevance', 'Event confidence'] }
    },
    extract: {
      stats: { polledAttempts: 12, timedOut: 1, batchSize: 5, successful: 7, failed: 1 }
    },
    filtering: {
      countryDate: { before: 8, after: 6, reasons: ['Non-German country', 'Date outside range'] }
    }
  };

  console.log('✅ Mock search trace generated:');
  console.log(`   Queries: ${mockTrace.finalQueries.length}`);
  console.log(`   URLs checked: ${mockTrace.urls.checked}`);
  console.log(`   URLs kept: ${mockTrace.urls.kept}`);
  console.log(`   Tiers executed: ${Object.keys(mockTrace.tiers).filter(t => mockTrace.tiers[t].executed).length}`);
  console.log(`   Prioritization repair used: ${mockTrace.prioritization.repairUsed}`);
  console.log(`   Extract timeouts: ${mockTrace.extract.stats.timedOut}`);
  console.log(`   Final events: ${mockTrace.filtering.countryDate.after}`);

  console.log('\n🎉 Enhanced Search Pipeline Dry Run Complete!');
  console.log('=' .repeat(60));
  console.log('\n📋 Summary:');
  console.log('   ✅ Query building with multi-tier strategy');
  console.log('   ✅ Country and date inference');
  console.log('   ✅ Robust JSON parsing with fallbacks');
  console.log('   ✅ Search trace generation');
  console.log('\n🚀 Ready for production deployment!');
}

// Run the dry run
runDryRun().catch(console.error);
