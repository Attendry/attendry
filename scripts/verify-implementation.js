#!/usr/bin/env node

/**
 * Implementation Verification Script
 * 
 * Verifies that all the debug search components are properly implemented.
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/config/flags.ts',
  'src/lib/trace.ts',
  'src/lib/filters/relaxed-filters.ts',
  'src/lib/search/tier-guardrails.ts',
  'src/lib/ai/gemini-bypass.ts',
  'src/lib/extraction/timeout-handler.ts',
  'src/app/api/debug/test-search/route.ts',
  'src/lib/search/query-optimizer.ts',
  'src/lib/telemetry/search-telemetry.ts',
  'src/lib/search/search-orchestrator.ts',
  'DEBUG_CONFIG.md',
  'scripts/test-debug-endpoint.js'
];

const requiredExports = {
  'src/config/flags.ts': ['FLAGS', 'getFlag', 'isRelaxedMode', 'getDebugConfig'],
  'src/lib/trace.ts': ['createSearchTrace', 'logSearchTrace', 'logSearchSummary', 'SearchTrace'],
  'src/lib/filters/relaxed-filters.ts': ['filterByCountryRelaxed', 'filterByDateRelaxed', 'applyRelaxedFilters'],
  'src/lib/search/tier-guardrails.ts': ['executeAllTiers', 'generateSearchTiers'],
  'src/lib/ai/gemini-bypass.ts': ['prioritizeWithBypass', 'bypassGeminiPrioritization'],
  'src/lib/extraction/timeout-handler.ts': ['extractWithFallbacks', 'extractEventsWithTimeouts'],
  'src/lib/search/query-optimizer.ts': ['optimizeSearchQuery', 'createFallbackQueries'],
  'src/lib/telemetry/search-telemetry.ts': ['logSearchTelemetry', 'logSearchSummary'],
  'src/lib/search/search-orchestrator.ts': ['runSearchOrchestrator']
};

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkFileContent(filePath, requiredExports) {
  if (!checkFileExists(filePath)) {
    return { exists: false, exports: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const foundExports = [];
  
  for (const exportName of requiredExports) {
    if (content.includes(`export ${exportName}`) || 
        content.includes(`export function ${exportName}`) ||
        content.includes(`export const ${exportName}`) ||
        content.includes(`export type ${exportName}`) ||
        content.includes(`export interface ${exportName}`) ||
        content.includes(`export class ${exportName}`) ||
        content.includes(`export async function ${exportName}`)) {
      foundExports.push(exportName);
    }
  }
  
  return { exists: true, exports: foundExports };
}

function main() {
  console.log('🔍 Verifying Debug Search Implementation');
  console.log('=====================================\n');
  
  let allPassed = true;
  
  // Check required files
  console.log('📁 Checking Required Files:');
  for (const file of requiredFiles) {
    const exists = checkFileExists(file);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allPassed = false;
  }
  
  console.log('\n📦 Checking Required Exports:');
  for (const [file, exports] of Object.entries(requiredExports)) {
    const result = checkFileContent(file, exports);
    if (result.exists) {
      console.log(`  📄 ${file}:`);
      for (const exportName of exports) {
        const hasExport = result.exports.includes(exportName);
        console.log(`    ${hasExport ? '✅' : '❌'} ${exportName}`);
        if (!hasExport) allPassed = false;
      }
    } else {
      console.log(`  ❌ ${file}: File not found`);
      allPassed = false;
    }
  }
  
  // Check environment configuration
  console.log('\n🔧 Checking Environment Configuration:');
  const envExample = checkFileExists('DEBUG_CONFIG.md');
  console.log(`  ${envExample ? '✅' : '❌'} DEBUG_CONFIG.md`);
  if (!envExample) allPassed = false;
  
  // Check Jest configuration
  console.log('\n🧪 Checking Jest Configuration:');
  const jestConfig = checkFileExists('jest.config.js');
  if (jestConfig) {
    const jestContent = fs.readFileSync('jest.config.js', 'utf8');
    const hasModuleNameMapper = jestContent.includes('moduleNameMapper');
    console.log(`  ${hasModuleNameMapper ? '✅' : '❌'} moduleNameMapper configured`);
    if (!hasModuleNameMapper) allPassed = false;
  } else {
    console.log('  ❌ jest.config.js not found');
    allPassed = false;
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Files created: ${requiredFiles.filter(checkFileExists).length}/${requiredFiles.length}`);
  console.log(`  Implementation: ${allPassed ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
  
  if (allPassed) {
    console.log('\n🎉 All components implemented successfully!');
    console.log('\n📋 Next Steps:');
    console.log('  1. Add environment variables to .env.local (see DEBUG_CONFIG.md)');
    console.log('  2. Deploy to Vercel with debug flags enabled');
    console.log('  3. Test the debug endpoint: /api/debug/test-search');
    console.log('  4. Monitor logs for search trace information');
    console.log('  5. Gradually tighten flags once issues are identified');
  } else {
    console.log('\n❌ Some components are missing or incomplete.');
    console.log('Please check the failed items above and complete the implementation.');
  }
  
  return allPassed;
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { main };
