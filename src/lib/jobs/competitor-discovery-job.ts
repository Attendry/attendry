/**
 * Competitor Discovery Background Job
 * 
 * Enhancement 4: Weekly discovery of new competitors
 * 
 * Run as a cron job (e.g., weekly on Monday at 3 AM)
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { discoverCompetitors } from '../services/competitor-discovery-service';
import { UserProfile } from '@/lib/types/core';

/**
 * Run discovery for all active users
 */
export async function runDiscoveryForAllUsers(): Promise<void> {
  console.log('[CompetitorDiscoveryJob] Starting competitor discovery...');
  
  const supabase = supabaseAdmin();
  
  // Get all active users (users who have events in their board)
  const { data: activeUsers, error: usersError } = await supabase
    .from('user_event_board')
    .select('user_id')
    .limit(1000); // Limit for performance
  
  if (usersError) {
    console.error('[CompetitorDiscoveryJob] Error fetching active users:', usersError);
    return;
  }
  
  if (!activeUsers || activeUsers.length === 0) {
    console.log('[CompetitorDiscoveryJob] No active users found');
    return;
  }
  
  // Get unique user IDs
  const userIds = [...new Set(activeUsers.map(u => u.user_id))];
  
  let successCount = 0;
  let errorCount = 0;
  let suggestionsCount = 0;
  
  // Process each user
  for (const userId of userIds) {
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!profile) continue;
      
      const userProfile: UserProfile = {
        id: profile.id,
        full_name: profile.full_name,
        company: profile.company,
        competitors: profile.competitors || [],
        icp_terms: profile.icp_terms || [],
        industry_terms: profile.industry_terms || []
      };
      
      // Discover competitors
      const suggestions = await discoverCompetitors(userId, userProfile);
      
      if (suggestions.length > 0) {
        // Store suggestions (could send email notification)
        // For now, just log
        console.log(
          `[CompetitorDiscoveryJob] Found ${suggestions.length} suggestions for user ${userId}`
        );
        suggestionsCount += suggestions.length;
      }
      
      successCount++;
    } catch (error) {
      console.error(`[CompetitorDiscoveryJob] Error processing user ${userId}:`, error);
      errorCount++;
    }
  }
  
  console.log(
    `[CompetitorDiscoveryJob] Completed: ${successCount} users processed, ` +
    `${suggestionsCount} total suggestions, ${errorCount} errors`
  );
}

