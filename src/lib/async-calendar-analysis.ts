import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseServer } from '@/lib/supabase-server';

interface AsyncAnalysisJob {
  id: string;
  eventUrl: string;
  eventTitle?: string;
  eventDate?: string;
  country?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// In-memory job store (in production, use Redis or database)
const jobStore = new Map<string, AsyncAnalysisJob>();

export async function startAsyncCalendarAnalysis(
  eventUrl: string,
  eventTitle?: string,
  eventDate?: string,
  country?: string
): Promise<string> {
  const jobId = `calendar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const job: AsyncAnalysisJob = {
    id: jobId,
    eventUrl,
    eventTitle,
    eventDate,
    country,
    status: 'pending',
    progress: 0,
    startedAt: new Date()
  };
  
  jobStore.set(jobId, job);
  
  // Start background processing
  processCalendarAnalysisAsync(jobId).catch(error => {
    console.error('Async calendar analysis failed:', error);
    const job = jobStore.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
    }
  });
  
  return jobId;
}

export async function getAsyncAnalysisStatus(jobId: string): Promise<AsyncAnalysisJob | null> {
  return jobStore.get(jobId) || null;
}

async function processCalendarAnalysisAsync(jobId: string): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  
  try {
    job.status = 'processing';
    job.progress = 10;
    
    // Import the calendar analysis function
    const { analyzeCalendarEvent } = await import('./calendar-analysis');
    
    job.progress = 20;
    
    // Perform the analysis without timeout (let it run as long as needed)
    const result = await analyzeCalendarEvent(
      job.eventUrl,
      job.eventTitle,
      job.eventDate,
      job.country
    );
    
    job.progress = 90;
    
    // Store result in database for persistence
    await storeAnalysisResult(job.eventUrl, result);
    
    job.progress = 100;
    job.status = 'completed';
    job.result = result;
    job.completedAt = new Date();
    
    console.log(`Async calendar analysis completed for job ${jobId}:`, {
      speakers_found: result.speakers?.length || 0,
      pages_crawled: result.crawl_stats?.pages_crawled || 0
    });
    
  } catch (error) {
    console.error(`Async calendar analysis failed for job ${jobId}:`, error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.completedAt = new Date();
  }
}

async function storeAnalysisResult(eventUrl: string, result: any): Promise<void> {
  try {
    const supabase = await supabaseServer();
    
    // Store in event_analysis_cache table
    await supabase
      .from('event_analysis_cache')
      .upsert({
        event_url: eventUrl,
        analysis_result: result,
        cached_at: new Date().toISOString()
      }, {
        onConflict: 'event_url'
      });
      
    console.log('Analysis result stored in cache for:', eventUrl);
  } catch (error) {
    console.error('Failed to store analysis result:', error);
  }
}

// Cleanup old jobs (run periodically)
export function cleanupOldJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [jobId, job] of jobStore.entries()) {
    if (job.startedAt < oneHourAgo) {
      jobStore.delete(jobId);
    }
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupOldJobs, 30 * 60 * 1000);
