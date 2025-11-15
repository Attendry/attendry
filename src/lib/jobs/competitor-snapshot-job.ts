/**
 * Competitor Snapshot Background Job
 * 
 * Enhancement 3: Generates daily/weekly/monthly snapshots of competitor activity
 * 
 * Run as a cron job (e.g., daily at 2 AM)
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateCompetitorSnapshot } from '../services/competitor-history-service';

/**
 * Generate snapshots for all users' competitors
 */
export async function generateAllCompetitorSnapshots(
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' = 'daily'
): Promise<void> {
  console.log(`[CompetitorSnapshotJob] Starting ${periodType} snapshot generation...`);
  
  const supabase = supabaseAdmin();
  const snapshotDate = new Date();
  
  // Get all users with competitors
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, competitors')
    .not('competitors', 'is', null);
  
  if (profilesError) {
    console.error('[CompetitorSnapshotJob] Error fetching profiles:', profilesError);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
    console.log('[CompetitorSnapshotJob] No users with competitors found');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process each user
  for (const profile of profiles) {
    const competitors = profile.competitors || [];
    
    if (competitors.length === 0) continue;
    
    // Generate snapshots for each competitor
    for (const competitor of competitors) {
      try {
        await generateCompetitorSnapshot(
          profile.id,
          competitor,
          periodType,
          snapshotDate
        );
        successCount++;
      } catch (error) {
        console.error(
          `[CompetitorSnapshotJob] Error generating snapshot for ${competitor} (user ${profile.id}):`,
          error
        );
        errorCount++;
      }
    }
  }
  
  console.log(
    `[CompetitorSnapshotJob] Completed: ${successCount} successful, ${errorCount} errors`
  );
}

/**
 * Cleanup old snapshots (retention policy)
 */
export async function cleanupOldSnapshots(retentionDays: number = 365): Promise<void> {
  console.log(`[CompetitorSnapshotJob] Cleaning up snapshots older than ${retentionDays} days...`);
  
  const supabase = supabaseAdmin();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const { error } = await supabase
    .from('competitor_activity_snapshots')
    .delete()
    .lt('snapshot_date', cutoffDate.toISOString().split('T')[0]);
  
  if (error) {
    console.error('[CompetitorSnapshotJob] Error cleaning up snapshots:', error);
  } else {
    console.log('[CompetitorSnapshotJob] Cleanup completed');
  }
}

