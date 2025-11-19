/**
 * PHASE 3: User Migration Script
 * 
 * Migrates existing users from old profile system to new discovery profiles.
 * Converts:
 * - industries from industry_terms
 * - ICP from icp_terms
 * - competitors from competitors
 * - watchlist companies from watchlists (kind='company')
 * 
 * Usage:
 *   npx tsx src/lib/scripts/migrate-users-to-discovery-profiles.ts
 */

import { supabaseServer } from '@/lib/supabase-server';
import { DiscoveryEngine } from '@/lib/services/discovery-engine';

interface OldProfile {
  id: string;
  user_id: string;
  industry_terms?: string[];
  icp_terms?: string[];
  competitors?: string[];
}

interface WatchlistItem {
  id: string;
  user_id: string;
  kind: string;
  value: string;
}

async function migrateUsers() {
  console.log('🚀 Starting user migration to discovery profiles...\n');

  const supabase = await supabaseServer();

  // Step 1: Get all existing profiles
  console.log('📋 Step 1: Fetching existing profiles...');
  const { data: oldProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, user_id, industry_terms, icp_terms, competitors');

  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError);
    process.exit(1);
  }

  if (!oldProfiles || oldProfiles.length === 0) {
    console.log('✅ No profiles to migrate');
    return;
  }

  console.log(`   Found ${oldProfiles.length} profiles to migrate\n`);

  // Step 2: Get all watchlists
  console.log('📋 Step 2: Fetching watchlists...');
  const { data: watchlists, error: watchlistsError } = await supabase
    .from('watchlists')
    .select('id, user_id, kind, value')
    .eq('kind', 'company');

  if (watchlistsError) {
    console.error('❌ Error fetching watchlists:', watchlistsError);
    // Continue anyway - watchlists are optional
  }

  // Group watchlists by user_id
  const watchlistsByUser = new Map<string, string[]>();
  if (watchlists) {
    for (const watchlist of watchlists) {
      if (!watchlistsByUser.has(watchlist.user_id)) {
        watchlistsByUser.set(watchlist.user_id, []);
      }
      watchlistsByUser.get(watchlist.user_id)!.push(watchlist.value);
    }
  }

  console.log(`   Found ${watchlists?.length || 0} company watchlist items\n`);

  // Step 3: Check which users already have discovery profiles
  console.log('📋 Step 3: Checking existing discovery profiles...');
  const { data: existingProfiles, error: existingError } = await supabase
    .from('user_discovery_profiles')
    .select('user_id');

  if (existingError) {
    console.error('❌ Error checking existing profiles:', existingError);
    process.exit(1);
  }

  const existingUserIds = new Set(existingProfiles?.map(p => p.user_id) || []);
  console.log(`   Found ${existingUserIds.size} users with existing discovery profiles\n`);

  // Step 4: Migrate each profile
  console.log('📋 Step 4: Migrating profiles...\n');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const profile of oldProfiles) {
    try {
      // Skip if already has discovery profile
      if (existingUserIds.has(profile.user_id)) {
        console.log(`   ⏭️  Skipping user ${profile.user_id} (already has discovery profile)`);
        skipped++;
        continue;
      }

      // Extract data
      const industries = profile.industry_terms || [];
      const targetTitles = profile.icp_terms || [];
      const competitors = profile.competitors || [];
      const targetCompanies = watchlistsByUser.get(profile.user_id) || [];

      // Skip if no data to migrate
      if (industries.length === 0 && targetTitles.length === 0 && targetCompanies.length === 0) {
        console.log(`   ⏭️  Skipping user ${profile.user_id} (no data to migrate)`);
        skipped++;
        continue;
      }

      // Create discovery profile
      const { data: newProfile, error: createError } = await supabase
        .from('user_discovery_profiles')
        .insert({
          user_id: profile.user_id,
          industries: industries,
          event_types: [], // Can be added later
          regions: ['United States', 'United Kingdom', 'Germany', 'France'], // Default regions
          date_range_days: 90, // Default 3 months
          target_titles: targetTitles,
          target_companies: targetCompanies,
          competitors: competitors,
          discovery_frequency: 'daily', // Default frequency
          min_relevance_score: 50, // Default threshold
          enable_critical_alerts: targetCompanies.length > 0 // Enable if has watchlist
        })
        .select()
        .single();

      if (createError) {
        console.error(`   ❌ Error creating discovery profile for user ${profile.user_id}:`, createError);
        errors++;
        continue;
      }

      console.log(`   ✅ Migrated user ${profile.user_id}:`);
      console.log(`      - Industries: ${industries.length}`);
      console.log(`      - Target Titles: ${targetTitles.length}`);
      console.log(`      - Target Companies: ${targetCompanies.length}`);
      console.log(`      - Competitors: ${competitors.length}`);

      migrated++;
    } catch (error) {
      console.error(`   ❌ Error migrating user ${profile.user_id}:`, error);
      errors++;
    }
  }

  // Step 5: Summary
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📝 Total: ${oldProfiles.length}\n`);

  // Step 6: Optional - Run initial discovery for migrated users
  if (migrated > 0) {
    console.log('📋 Step 5: Running initial discovery for migrated users...\n');
    
    const { data: newProfiles } = await supabase
      .from('user_discovery_profiles')
      .select('user_id')
      .in('user_id', oldProfiles.map(p => p.user_id));

    if (newProfiles) {
      let discoveryCount = 0;
      for (const profile of newProfiles.slice(0, 10)) { // Limit to first 10 for testing
        try {
          console.log(`   🔍 Running discovery for user ${profile.user_id}...`);
          await DiscoveryEngine.runDiscovery(profile.user_id);
          discoveryCount++;
          console.log(`   ✅ Discovery completed for user ${profile.user_id}`);
        } catch (error) {
          console.error(`   ❌ Discovery failed for user ${profile.user_id}:`, error);
        }
      }
      console.log(`\n   ✅ Ran initial discovery for ${discoveryCount} users`);
    }
  }

  console.log('\n🎉 Migration complete!');
}

// Run migration
migrateUsers()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

