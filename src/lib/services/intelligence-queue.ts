/**
 * Intelligence Queue Service
 * 
 * Pre-computes intelligence for events in background
 * Uses Vercel Cron pattern for background processing
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { EventData } from '@/lib/types/core';
import { precomputeIntelligenceForEvent } from './event-intelligence-service';

export interface IntelligenceQueueItem {
  event_id: string;
  priority: number;
  queued_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  error?: string;
}

/**
 * Queue intelligence generation for an event
 */
export async function queueIntelligenceGeneration(
  eventId: string,
  priority: number = 5
): Promise<void> {
  const supabase = supabaseAdmin();
  
  // Check if already queued or completed
  const { data: existing } = await supabase
    .from('intelligence_queue')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['pending', 'processing'])
    .single();
  
  if (existing) {
    return; // Already queued
  }
  
  // Add to queue
  await supabase
    .from('intelligence_queue')
    .insert({
      event_id: eventId,
      priority,
      status: 'pending',
      queued_at: new Date().toISOString(),
      attempts: 0
    });
}

/**
 * Process queued intelligence items
 */
export async function processIntelligenceQueue(limit: number = 10): Promise<{
  processed: number;
  failed: number;
  errors: string[];
}> {
  const supabase = supabaseAdmin();
  const errors: string[] = [];
  let processed = 0;
  let failed = 0;
  
  // Get pending items ordered by priority
  const { data: queueItems } = await supabase
    .from('intelligence_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('queued_at', { ascending: true })
    .limit(limit);
  
  if (!queueItems || queueItems.length === 0) {
    return { processed: 0, failed: 0, errors: [] };
  }
  
  for (const item of queueItems) {
    try {
      // Mark as processing
      await supabase
        .from('intelligence_queue')
        .update({ status: 'processing' })
        .eq('id', item.id);
      
      // Get event
      const { data: event, error: eventError } = await supabase
        .from('collected_events')
        .select('*')
        .or(`id.eq.${item.event_id},source_url.eq.${item.event_id}`)
        .single();
      
      if (eventError || !event) {
        throw new Error(`Event not found: ${item.event_id}`);
      }
      
      // Generate intelligence
      await precomputeIntelligenceForEvent(event as EventData);
      
      // Mark as completed
      await supabase
        .from('intelligence_queue')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', item.id);
      
      processed++;
    } catch (error: any) {
      const attempts = (item.attempts || 0) + 1;
      const maxAttempts = 3;
      
      if (attempts >= maxAttempts) {
        // Mark as failed
        await supabase
          .from('intelligence_queue')
          .update({ 
            status: 'failed',
            error: error.message,
            attempts
          })
          .eq('id', item.id);
        failed++;
      } else {
        // Retry
        await supabase
          .from('intelligence_queue')
          .update({ 
            status: 'pending',
            attempts,
            error: error.message
          })
          .eq('id', item.id);
      }
      
      errors.push(`${item.event_id}: ${error.message}`);
    }
  }
  
  return { processed, failed, errors };
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const supabase = supabaseAdmin();
  
  const { data: stats } = await supabase
    .from('intelligence_queue')
    .select('status');
  
  if (!stats) {
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }
  
  return {
    pending: stats.filter(s => s.status === 'pending').length,
    processing: stats.filter(s => s.status === 'processing').length,
    completed: stats.filter(s => s.status === 'completed').length,
    failed: stats.filter(s => s.status === 'failed').length
  };
}

