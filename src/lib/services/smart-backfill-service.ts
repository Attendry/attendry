/**
 * PHASE 1: Smart Backfill Service
 * 
 * Provides immediate "warm start" for new users by copying relevant opportunities
 * from users with similar discovery profiles. This prevents the "empty feed" problem
 * and gives new users value immediately upon onboarding.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { normalizeOrg } from '@/lib/utils/org-normalizer';

export interface ProfileSimilarity {
  userId: string;
  similarityScore: number; // 0-100
  matchingFactors: string[];
}

/**
 * Calculate similarity between two discovery profiles
 */
function calculateProfileSimilarity(
  profile1: {
    industries: string[];
    regions: string[];
    target_titles: string[];
    target_companies: string[];
  },
  profile2: {
    industries: string[];
    regions: string[];
    target_titles: string[];
    target_companies: string[];
  }
): ProfileSimilarity {
  let score = 0;
  const matchingFactors: string[] = [];

  // Industry match (40% weight)
  const industries1 = new Set(profile1.industries.map(i => i.toLowerCase()));
  const industries2 = new Set(profile2.industries.map(i => i.toLowerCase()));
  const industryIntersection = new Set([...industries1].filter(i => industries2.has(i)));
  const industryUnion = new Set([...industries1, ...industries2]);
  const industrySimilarity = industryUnion.size > 0 
    ? industryIntersection.size / industryUnion.size 
    : 0;
  score += industrySimilarity * 40;
  if (industrySimilarity > 0) {
    matchingFactors.push(`${industryIntersection.size} matching industries`);
  }

  // Region match (20% weight)
  const regions1 = new Set(profile1.regions.map(r => r.toLowerCase()));
  const regions2 = new Set(profile2.regions.map(r => r.toLowerCase()));
  const regionIntersection = new Set([...regions1].filter(r => regions2.has(r)));
  const regionUnion = new Set([...regions1, ...regions2]);
  const regionSimilarity = regionUnion.size > 0 
    ? regionIntersection.size / regionUnion.size 
    : 0;
  score += regionSimilarity * 20;
  if (regionSimilarity > 0) {
    matchingFactors.push(`${regionIntersection.size} matching regions`);
  }

  // Target titles match (20% weight)
  const titles1 = new Set(profile1.target_titles.map(t => t.toLowerCase()));
  const titles2 = new Set(profile2.target_titles.map(t => t.toLowerCase()));
  const titleIntersection = new Set([...titles1].filter(t => titles2.has(t)));
  const titleUnion = new Set([...titles1, ...titles2]);
  const titleSimilarity = titleUnion.size > 0 
    ? titleIntersection.size / titleUnion.size 
    : 0;
  score += titleSimilarity * 20;
  if (titleSimilarity > 0) {
    matchingFactors.push(`${titleIntersection.size} matching target titles`);
  }

  // Target companies match (20% weight)
  const companies1 = new Set(profile1.target_companies.map(c => normalizeOrg(c).toLowerCase()));
  const companies2 = new Set(profile2.target_companies.map(c => normalizeOrg(c).toLowerCase()));
  const companyIntersection = new Set([...companies1].filter(c => companies2.has(c)));
  const companyUnion = new Set([...companies1, ...companies2]);
  const companySimilarity = companyUnion.size > 0 
    ? companyIntersection.size / companyUnion.size 
    : 0;
  score += companySimilarity * 20;
  if (companySimilarity > 0) {
    matchingFactors.push(`${companyIntersection.size} matching target companies`);
  }

  return {
    userId: '', // Will be set by caller
    similarityScore: Math.round(score),
    matchingFactors
  };
}

/**
 * Find similar profiles for smart backfill
 */
export async function findSimilarProfiles(
  targetProfile: {
    user_id: string;
    industries: string[];
    regions: string[];
    target_titles: string[];
    target_companies: string[];
  },
  minSimilarity: number = 60
): Promise<ProfileSimilarity[]> {
  try {
    const supabase = await supabaseServer();
    
    // Get all other discovery profiles
    const { data: profiles, error } = await supabase
      .from('user_discovery_profiles')
      .select('user_id, industries, regions, target_titles, target_companies')
      .neq('user_id', targetProfile.user_id);

    if (error || !profiles) {
      console.error('[smart-backfill] Error fetching profiles:', error);
      return [];
    }

    // Calculate similarity for each profile
    const similarities: ProfileSimilarity[] = profiles.map(profile => {
      const similarity = calculateProfileSimilarity(
        {
          industries: targetProfile.industries || [],
          regions: targetProfile.regions || [],
          target_titles: targetProfile.target_titles || [],
          target_companies: targetProfile.target_companies || []
        },
        {
          industries: profile.industries || [],
          regions: profile.regions || [],
          target_titles: profile.target_titles || [],
          target_companies: profile.target_companies || []
        }
      );
      similarity.userId = profile.user_id;
      return similarity;
    });

    // Filter by minimum similarity and sort
    return similarities
      .filter(s => s.similarityScore >= minSimilarity)
      .sort((a, b) => b.similarityScore - a.similarityScore);
  } catch (error) {
    console.error('[smart-backfill] Exception finding similar profiles:', error);
    return [];
  }
}

/**
 * Copy opportunities from similar users to new user
 */
export async function smartBackfill(
  newUserId: string,
  maxOpportunities: number = 20
): Promise<{ opportunitiesCopied: number; sourcesUsed: number }> {
  try {
    const supabase = await supabaseServer();

    // Get new user's discovery profile
    const { data: newProfile, error: profileError } = await supabase
      .from('user_discovery_profiles')
      .select('*')
      .eq('user_id', newUserId)
      .single();

    if (profileError || !newProfile) {
      console.error('[smart-backfill] No discovery profile found for user:', newUserId);
      return { opportunitiesCopied: 0, sourcesUsed: 0 };
    }

    // Find similar profiles
    const similarProfiles = await findSimilarProfiles(newProfile, 60);
    
    if (similarProfiles.length === 0) {
      console.log('[smart-backfill] No similar profiles found for user:', newUserId);
      return { opportunitiesCopied: 0, sourcesUsed: 0 };
    }

    // Get opportunities from similar users
    const sourceUserIds = similarProfiles.slice(0, 5).map(p => p.userId); // Top 5 similar users
    const opportunitiesToCopy: any[] = [];

    for (const sourceUserId of sourceUserIds) {
      const { data: opportunities, error: oppError } = await supabase
        .from('user_opportunities')
        .select('*')
        .eq('user_id', sourceUserId)
        .in('status', ['new', 'viewed', 'saved'])
        .gte('relevance_score', newProfile.min_relevance_score || 50)
        .order('relevance_score', { ascending: false })
        .limit(maxOpportunities);

      if (!oppError && opportunities) {
        opportunitiesToCopy.push(...opportunities);
      }

      // Stop if we have enough opportunities
      if (opportunitiesToCopy.length >= maxOpportunities) {
        break;
      }
    }

    // Deduplicate by event_id
    const seenEvents = new Set<string>();
    const uniqueOpportunities = opportunitiesToCopy.filter(opp => {
      if (seenEvents.has(opp.event_id)) {
        return false;
      }
      seenEvents.add(opp.event_id);
      return true;
    });

    // Copy opportunities to new user
    let copied = 0;
    for (const opp of uniqueOpportunities.slice(0, maxOpportunities)) {
      const { error: insertError } = await supabase
        .from('user_opportunities')
        .insert({
          user_id: newUserId,
          event_id: opp.event_id,
          target_accounts_attending: opp.target_accounts_attending,
          icp_matches: opp.icp_matches,
          competitor_presence: opp.competitor_presence,
          account_connections: opp.account_connections,
          relevance_score: opp.relevance_score,
          relevance_reasons: opp.relevance_reasons,
          signal_strength: opp.signal_strength,
          status: 'new',
          discovery_method: 'smart_backfill',
          last_enriched_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!insertError) {
        copied++;
      }
    }

    console.log(JSON.stringify({
      at: 'smart_backfill_complete',
      userId: newUserId,
      opportunitiesCopied: copied,
      sourcesUsed: sourceUserIds.length,
      similarProfilesFound: similarProfiles.length
    }));

    return {
      opportunitiesCopied: copied,
      sourcesUsed: sourceUserIds.length
    };
  } catch (error) {
    console.error('[smart-backfill] Exception during smart backfill:', error);
    return { opportunitiesCopied: 0, sourcesUsed: 0 };
  }
}

/**
 * Trigger smart backfill when discovery profile is created
 * This should be called from an API endpoint or database trigger
 */
export async function triggerSmartBackfillOnProfileCreation(userId: string): Promise<void> {
  try {
    // Run smart backfill in background (non-blocking)
    smartBackfill(userId, 20).catch(error => {
      console.error('[smart-backfill] Background backfill failed:', error);
    });
  } catch (error) {
    console.error('[smart-backfill] Error triggering smart backfill:', error);
  }
}

