import { supabaseAdmin } from '@/lib/supabase-admin';

interface AsyncEventsJob {
  id: string;
  eventIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: any[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// In-memory job store (in production, use Redis or database)
const eventsJobStore = new Map<string, AsyncEventsJob>();

export async function startAsyncEventsAnalysis(eventIds: string[]): Promise<string> {
  const jobId = `events_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const job: AsyncEventsJob = {
    id: jobId,
    eventIds,
    status: 'pending',
    progress: 0,
    startedAt: new Date()
  };
  
  eventsJobStore.set(jobId, job);
  
  // Start background processing
  processEventsAnalysisAsync(jobId).catch(error => {
    console.error('Async events analysis failed:', error);
    const job = eventsJobStore.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    }
  });
  
  return jobId;
}

export async function getAsyncEventsStatus(jobId: string): Promise<AsyncEventsJob | null> {
  return eventsJobStore.get(jobId) || null;
}

async function processEventsAnalysisAsync(jobId: string): Promise<void> {
  const job = eventsJobStore.get(jobId);
  if (!job) {
    console.error(`[async-events] Job not found: ${jobId}`);
    throw new Error('Job not found');
  }
  
  console.log(`[async-events] Starting async processing for job ${jobId}`);
  
  try {
    job.status = 'processing';
    job.progress = 10;
    
    console.log(`[async-events] Starting analysis for job ${jobId} with ${job.eventIds.length} events`);
    
    // Import the hybrid speaker extractor
    const { enhanceEventsWithSuperiorSpeakers, convertEnhancedSpeakersToLegacy } = await import('./hybrid-speaker-extractor');
    
    job.progress = 20;
    
    // Get event data from database using admin client (no auth required)
    const supabase = supabaseAdmin();
    console.log(`[async-events] Fetching events from database for IDs:`, job.eventIds);
    
    console.log(`[async-events] Executing database query for ${job.eventIds.length} event IDs...`);
    
    const { data: events, error } = await supabase
      .from('collected_events')
      .select('*')
      .in('id', job.eventIds);
    
    console.log(`[async-events] Database query completed. Error:`, error);
    console.log(`[async-events] Events returned:`, events?.length || 0);
    
    if (error) {
      console.error(`[async-events] Database error:`, error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }
    
    console.log(`[async-events] Found ${events?.length || 0} events in database`);
    
    if (!events || events.length === 0) {
      console.error(`[async-events] No events found in database for IDs:`, job.eventIds);
      throw new Error('No events found in database');
    }
    
    console.log(`[async-events] Event details:`, events.map(e => ({ id: e.id, title: e.title, source_url: e.source_url })));
    
    job.progress = 30;
    
    // Convert to candidates format
    const candidates = events.map((event: any) => ({
      id: event.id,
      title: event.title,
      source_url: event.source_url,
      description: event.description,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      city: event.city,
      country: event.country,
      venue: event.venue,
      organizer: event.organizer,
      confidence: event.confidence,
      speakers: event.speakers || []
    }));
    
    job.progress = 40;
    
    console.log(`[async-events] Starting hybrid speaker extraction for ${candidates.length} candidates`);
    console.log(`[async-events] Candidate details:`, candidates.map(c => ({ id: c.id, title: c.title, source_url: c.source_url })));
    
    // Enhance with superior speaker extraction
    let enhancedCandidates: any[] = [];
    try {
      enhancedCandidates = await enhanceEventsWithSuperiorSpeakers(candidates, 2);
      console.log(`[async-events] Hybrid extraction completed, enhanced ${enhancedCandidates.length} candidates`);
      console.log(`[async-events] Enhanced candidates:`, enhancedCandidates.map(ec => ({ 
        id: ec.id, 
        speakers_found: ec.speakers_found, 
        enhanced_speakers: ec.enhanced_speakers?.length || 0 
      })));
    } catch (extractionError) {
      console.error(`[async-events] Hybrid extraction failed:`, extractionError);
      // Continue with empty enhanced candidates
      enhancedCandidates = [];
    }
    
    job.progress = 80;
    
    // Convert results back to events format
    const results = events.map((event: any) => {
      const enhanced = enhancedCandidates.find(ec => ec.id === event.id);
      if (enhanced && enhanced.enhanced_speakers && enhanced.enhanced_speakers.length > 0) {
        return {
          ...event,
          speakers: convertEnhancedSpeakersToLegacy(enhanced.enhanced_speakers),
          enhanced_speakers: enhanced.enhanced_speakers,
          analysis_completed: enhanced.analysis_completed,
          speakers_found: enhanced.speakers_found,
          crawl_stats: enhanced.crawl_stats,
          confidence: enhanced.enhanced_confidence || event.confidence
        };
      }
      return event;
    });
    
    job.progress = 90;
    
    console.log(`[async-events] Final results:`, results.map(r => ({ 
      id: r.id, 
      title: r.title, 
      speakers_count: r.speakers?.length || 0,
      enhanced_speakers_count: r.enhanced_speakers?.length || 0
    })));
    
    // Store enhanced results in database
    console.log(`[async-events] Storing enhanced results in database...`);
    try {
      await storeEnhancedEvents(results);
      console.log(`[async-events] Successfully stored enhanced results`);
    } catch (storeError) {
      console.error(`[async-events] Failed to store enhanced results:`, storeError);
      // Don't fail the entire job if storage fails
    }
    
    job.progress = 100;
    job.status = 'completed';
    job.results = results;
    job.completedAt = new Date();
    
    console.log(`[async-events] Async events analysis completed for job ${jobId}:`, {
      events_enhanced: enhancedCandidates.length,
      total_speakers: enhancedCandidates.reduce((sum, ec) => sum + (ec.enhanced_speakers?.length || 0), 0)
    });
    
  } catch (error) {
    console.error(`Async events analysis failed for job ${jobId}:`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.completedAt = new Date();
  }
}

async function storeEnhancedEvents(events: any[]): Promise<void> {
  try {
    console.log(`[async-events] storeEnhancedEvents: Starting to store ${events.length} events`);
    const supabase = supabaseAdmin();
    
    // Update events with enhanced speaker data
    for (const event of events) {
      console.log(`[async-events] storeEnhancedEvents: Updating event ${event.id}`);
      
      const updateData = {
        speakers: event.speakers,
        enhanced_speakers: event.enhanced_speakers,
        analysis_completed: event.analysis_completed,
        speakers_found: event.speakers_found,
        crawl_stats: event.crawl_stats,
        confidence: event.confidence,
        updated_at: new Date().toISOString()
      };
      
      console.log(`[async-events] storeEnhancedEvents: Update data for ${event.id}:`, {
        speakers_count: event.speakers?.length || 0,
        enhanced_speakers_count: event.enhanced_speakers?.length || 0,
        analysis_completed: event.analysis_completed,
        speakers_found: event.speakers_found
      });
      
      const { error: updateError } = await supabase
        .from('collected_events')
        .update(updateData)
        .eq('id', event.id);
        
      if (updateError) {
        console.error(`[async-events] storeEnhancedEvents: Failed to update event ${event.id}:`, updateError);
        throw updateError;
      } else {
        console.log(`[async-events] storeEnhancedEvents: Successfully updated event ${event.id}`);
      }
    }
    
    console.log('Enhanced events stored in database:', events.length);
  } catch (error) {
    console.error('Failed to store enhanced events:', error);
  }
}

// Cleanup old jobs (run periodically)
export function cleanupOldEventsJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [jobId, job] of eventsJobStore.entries()) {
    if (job.startedAt < oneHourAgo) {
      eventsJobStore.delete(jobId);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupOldEventsJobs, 30 * 60 * 1000);
