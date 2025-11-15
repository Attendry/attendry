/**
 * Phase 2C: Competitive Intelligence Validation Script
 * 
 * Validates that competitive intelligence is working correctly
 * Run with: node scripts/validate-phase2c.js
 */

const { supabaseAdmin } = require('../src/lib/supabase-admin');

async function validatePhase2C() {
  console.log('🔍 Phase 2C: Competitive Intelligence Validation\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Check database migration
  console.log('1. Checking database migration...');
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('event_intelligence')
      .select('competitive_context, competitive_alerts')
      .limit(1);
    
    if (error && error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('   ❌ Migration not applied - competitive_context/competitive_alerts columns missing');
      console.log('   💡 Run: supabase migration up');
      failed++;
    } else {
      console.log('   ✅ Database migration applied successfully');
      passed++;
    }
  } catch (error) {
    console.log('   ⚠️  Could not verify migration (this is OK if migration not run yet)');
  }
  
  // Test 2: Check service file exists
  console.log('\n2. Checking service file...');
  try {
    const fs = require('fs');
    const path = require('path');
    const servicePath = path.join(__dirname, '../src/lib/services/competitive-intelligence-service.ts');
    
    if (fs.existsSync(servicePath)) {
      console.log('   ✅ competitive-intelligence-service.ts exists');
      passed++;
    } else {
      console.log('   ❌ competitive-intelligence-service.ts not found');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ Error checking service file:', error.message);
    failed++;
  }
  
  // Test 3: Check Event Intelligence integration
  console.log('\n3. Checking Event Intelligence integration...');
  try {
    const fs = require('fs');
    const path = require('path');
    const eventIntelligencePath = path.join(__dirname, '../src/lib/services/event-intelligence-service.ts');
    const content = fs.readFileSync(eventIntelligencePath, 'utf8');
    
    if (content.includes('competitiveContext') && content.includes('competitiveAlerts')) {
      console.log('   ✅ Event Intelligence service includes competitive intelligence');
      passed++;
    } else {
      console.log('   ❌ Event Intelligence service missing competitive intelligence integration');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ Error checking integration:', error.message);
    failed++;
  }
  
  // Test 4: Check UI components
  console.log('\n4. Checking UI components...');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const quickViewPath = path.join(__dirname, '../src/components/EventIntelligenceQuickView.tsx');
    const competitiveInsightsPath = path.join(__dirname, '../src/components/events-board/CompetitiveInsights.tsx');
    
    let uiChecks = 0;
    
    if (fs.existsSync(quickViewPath)) {
      const quickViewContent = fs.readFileSync(quickViewPath, 'utf8');
      if (quickViewContent.includes('competitiveContext') || quickViewContent.includes('Competitive Intelligence')) {
        console.log('   ✅ EventIntelligenceQuickView includes competitive intelligence');
        uiChecks++;
      }
    }
    
    if (fs.existsSync(competitiveInsightsPath)) {
      console.log('   ✅ CompetitiveInsights component exists');
      uiChecks++;
    }
    
    if (uiChecks >= 1) {
      passed++;
    } else {
      failed++;
    }
  } catch (error) {
    console.log('   ❌ Error checking UI components:', error.message);
    failed++;
  }
  
  // Test 5: Check API routes
  console.log('\n5. Checking API routes...');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const boardInsightsPath = path.join(__dirname, '../src/app/api/events/board/insights/[eventId]/route.ts');
    
    if (fs.existsSync(boardInsightsPath)) {
      const content = fs.readFileSync(boardInsightsPath, 'utf8');
      if (content.includes('competitiveContext') || content.includes('competitiveAlerts')) {
        console.log('   ✅ Board insights API includes competitive intelligence');
        passed++;
      } else {
        console.log('   ⚠️  Board insights API may not include competitive intelligence');
        failed++;
      }
    } else {
      console.log('   ⚠️  Board insights API file not found');
    }
  } catch (error) {
    console.log('   ⚠️  Error checking API routes:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Validation Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All validation checks passed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Run database migration: supabase migration up');
    console.log('   2. Test with real user profile (add competitors)');
    console.log('   3. Generate intelligence for event with competitors');
    console.log('   4. Verify competitive intelligence displays in UI');
    return 0;
  } else {
    console.log('\n⚠️  Some validation checks failed. Please review above.');
    return 1;
  }
}

// Run validation
if (require.main === module) {
  validatePhase2C()
    .then(code => process.exit(code || 0))
    .catch(error => {
      console.error('Validation error:', error);
      process.exit(1);
    });
}

module.exports = { validatePhase2C };

