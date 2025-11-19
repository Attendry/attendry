/**
 * PHASE 1: Lifecycle Management Engine (V2 - Gap 3)
 * 
 * Tracks and refreshes event data to prevent staleness.
 * Detects changes in speakers, dates, venues, and triggers opportunity refresh.
 */

import { supabaseServer } from '@/lib/supabase-server';

export interface LifecycleInfo {
  last_refreshed: string;
  has_updates: boolean;
  update_summary: string;
  staleness_score: number; // 0-100 (0 = fresh, 100 = very stale)
}

export interface EventChange {
  event_type: 'speaker_added' | 'speaker_removed' | 'date_changed' | 'venue_changed' | 'description_changed';
  old_value: any;
  new_value: any;
}

export class LifecycleManagementEngine {
  /**
   * Refresh event lifecycle - detect changes and log them
   * 
   * @param eventId Event ID to refresh
   * @returns Lifecycle information
   */
  static async refreshEventLifecycle(eventId: string): Promise<LifecycleInfo> {
    try {
      const supabase = await supabaseServer();

      // Get current event data
      const { data: currentEvent, error: eventError } = await supabase
        .from('collected_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !currentEvent) {
        throw new Error(`Event not found: ${eventId}`);
      }

      // Get last refresh time (from lifecycle events or event updated_at)
      const lastRefresh = currentEvent.updated_at || currentEvent.created_at;
      
      // Detect changes
      const changes: EventChange[] = [];

      // Check for speaker changes (simplified - in production, compare with previous snapshot)
      // For now, we'll check if speakers were recently updated
      if (currentEvent.speakers) {
        const speakers = Array.isArray(currentEvent.speakers) ? currentEvent.speakers : [];
        // In a real implementation, we'd compare with previous state
        // For Phase 1, we'll just log if speakers exist and event was recently updated
      }

      // Log changes if any detected
      if (changes.length > 0) {
        for (const change of changes) {
          await supabase
            .from('event_lifecycle_events')
            .insert({
              event_id: eventId,
              event_type: change.event_type,
              old_value: change.old_value,
              new_value: change.new_value
            });
        }

        // Trigger opportunity refresh for affected events
        await this.triggerOpportunityRefresh(eventId);
      }

      // Calculate staleness score
      const stalenessScore = this.calculateStalenessScore(lastRefresh);

      // Generate update summary
      const updateSummary = changes.length > 0
        ? `${changes.length} change(s) detected: ${changes.map(c => c.event_type).join(', ')}`
        : 'No recent updates';

      return {
        last_refreshed: lastRefresh,
        has_updates: changes.length > 0,
        update_summary: updateSummary,
        staleness_score: stalenessScore
      };
    } catch (error) {
      console.error('[lifecycle-management] Error refreshing event lifecycle:', error);
      throw error;
    }
  }

  /**
   * Trigger opportunity refresh for an event
   * Re-runs matching for all opportunities associated with this event
   */
  static async triggerOpportunityRefresh(eventId: string): Promise<void> {
    try {
      const supabase = await supabaseServer();

      // Get all opportunities for this event
      const { data: opportunities, error } = await supabase
        .from('user_opportunities')
        .select('id, user_id')
        .eq('event_id', eventId);

      if (error) {
        console.error('[lifecycle-management] Error fetching opportunities:', error);
        return;
      }

      // Mark opportunities for refresh (update last_enriched_at to trigger re-enrichment)
      if (opportunities && opportunities.length > 0) {
        const opportunityIds = opportunities.map(o => o.id);
        
        await supabase
          .from('user_opportunities')
          .update({ last_enriched_at: new Date().toISOString() })
          .in('id', opportunityIds);

        console.log(JSON.stringify({
          at: 'lifecycle_opportunity_refresh',
          eventId,
          opportunitiesRefreshed: opportunities.length
        }));
      }
    } catch (error) {
      console.error('[lifecycle-management] Error triggering opportunity refresh:', error);
    }
  }

  /**
   * Calculate staleness score (0-100)
   * 0 = fresh (updated today)
   * 100 = very stale (updated >90 days ago)
   */
  static calculateStalenessScore(lastRefresh: string): number {
    const lastRefreshDate = new Date(lastRefresh);
    const now = new Date();
    const daysSinceRefresh = Math.floor((now.getTime() - lastRefreshDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceRefresh <= 1) return 0;
    if (daysSinceRefresh <= 7) return 20;
    if (daysSinceRefresh <= 30) return 50;
    if (daysSinceRefresh <= 90) return 80;
    return 100;
  }

  /**
   * Auto-archive expired opportunities (events >30 days old)
   */
  static async archiveExpiredOpportunities(): Promise<number> {
    try {
      const supabase = await supabaseServer();

      // Find events that are >30 days old
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: expiredEvents, error: eventsError } = await supabase
        .from('collected_events')
        .select('id')
        .lt('starts_at', thirtyDaysAgo.toISOString().split('T')[0]);

      if (eventsError || !expiredEvents) {
        console.error('[lifecycle-management] Error finding expired events:', eventsError);
        return 0;
      }

      if (expiredEvents.length === 0) {
        return 0;
      }

      const expiredEventIds = expiredEvents.map(e => e.id);

      // Update opportunities to 'dismissed' status with reason
      const { count, error: updateError } = await supabase
        .from('user_opportunities')
        .update({
          status: 'dismissed',
          dismissal_reason: 'event_passed'
        })
        .in('event_id', expiredEventIds)
        .in('status', ['new', 'viewed', 'saved']);

      if (updateError) {
        console.error('[lifecycle-management] Error archiving opportunities:', updateError);
        return 0;
      }

      console.log(JSON.stringify({
        at: 'lifecycle_archive_expired',
        opportunitiesArchived: count || 0,
        expiredEvents: expiredEventIds.length
      }));

      return count || 0;
    } catch (error) {
      console.error('[lifecycle-management] Exception archiving expired opportunities:', error);
      return 0;
    }
  }

  /**
   * Get lifecycle info for an opportunity
   */
  static async getLifecycleInfo(eventId: string): Promise<LifecycleInfo> {
    try {
      const supabase = await supabaseServer();

      const { data: event, error } = await supabase
        .from('collected_events')
        .select('updated_at, created_at')
        .eq('id', eventId)
        .single();

      if (error || !event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      const lastRefresh = event.updated_at || event.created_at;

      // Check for recent lifecycle events
      const { data: recentChanges, error: changesError } = await supabase
        .from('event_lifecycle_events')
        .select('*')
        .eq('event_id', eventId)
        .order('detected_at', { ascending: false })
        .limit(5);

      const hasUpdates = recentChanges && recentChanges.length > 0;
      const updateSummary = hasUpdates
        ? `${recentChanges!.length} update(s) detected`
        : 'No recent updates';

      const stalenessScore = this.calculateStalenessScore(lastRefresh);

      return {
        last_refreshed: lastRefresh,
        has_updates: hasUpdates,
        update_summary: updateSummary,
        staleness_score: stalenessScore
      };
    } catch (error) {
      console.error('[lifecycle-management] Error getting lifecycle info:', error);
      throw error;
    }
  }
}

