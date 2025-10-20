import { supabaseServer } from '@/lib/supabase-server';

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
    throw new Error('Job not found');
  }
  
  try {
    job.status = 'processing';
    job.progress = 10;
    
    console.log(`[async-events] Starting analysis for job ${jobId} with ${job.eventIds.length} events`);
    
    // Import the hybrid speaker extractor
    const { enhanceEventsWithSuperiorSpeakers, convertEnhancedSpeakersToLegacy } = await import('./hybrid-speaker-extractor');
    
    job.progress = 20;
    
    // Get event data from database
    const supabase = await supabaseServer();
    console.log(`[async-events] Fetching events from database for IDs:`, job.eventIds);
    
    const { data: events, error } = await supabase
      .from('collected_events')
      .select('*')
      .in('id', job.eventIds);
    
    if (error) {
      console.error(`[async-events] Database error:`, error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }
    
    console.log(`[async-events] Found ${events?.length || 0} events in database`);
    
    if (!events || events.length === 0) {
      throw new Error('No events found in database');
    }
    
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
    
    // Enhance with superior speaker extraction
    const enhancedCandidates = await enhanceEventsWithSuperiorSpeakers(candidates, 2);
    
    console.log(`[async-events] Hybrid extraction completed, enhanced ${enhancedCandidates.length} candidates`);
    
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
    
    // Store enhanced results in database
    await storeEnhancedEvents(results);
    
    job.progress = 100;
    job.status = 'completed';
    job.results = results;
    job.completedAt = new Date();
    
    console.log(`Async events analysis completed for job ${jobId}:`, {
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
    const supabase = await supabaseServer();
    
    // Update events with enhanced speaker data
    for (const event of events) {
      await supabase
        .from('collected_events')
        .update({
          speakers: event.speakers,
          enhanced_speakers: event.enhanced_speakers,
          analysis_completed: event.analysis_completed,
          speakers_found: event.speakers_found,
          crawl_stats: event.crawl_stats,
          confidence: event.confidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);
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
