import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAsyncAnalysisStatus } from '@/lib/async-calendar-analysis';
import { getAsyncEventsStatus } from '@/lib/async-events-analysis';

// GET /api/events/analysis-status?jobId=xxx - Check async analysis status
export async function GET(req: NextRequest): Promise<NextResponse> {
  console.log('[analysis-status] API endpoint called');
  
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const extractionId = searchParams.get('extractionId');
    
    console.log('[analysis-status] Request params:', { jobId, extractionId });
    
    if (!jobId && !extractionId) {
      return NextResponse.json({ 
        success: false,
        error: "Either jobId or extractionId is required" 
      }, { status: 400 });
    }
    
    // If we have a jobId, check the async job status
    if (jobId) {
      let jobStatus;
      
      // Check if it's a calendar job or events job
      if (jobId.startsWith('calendar_')) {
        console.log('[analysis-status] Loading calendar analysis status for job:', jobId);
        jobStatus = await getAsyncAnalysisStatus(jobId);
        console.log('[analysis-status] Calendar job status:', jobStatus ? 'found' : 'not found');
      } else if (jobId.startsWith('events_')) {
        console.log('[analysis-status] Loading events analysis status for job:', jobId);
        jobStatus = await getAsyncEventsStatus(jobId);
        console.log('[analysis-status] Events job status:', jobStatus ? 'found' : 'not found');
      } else {
        console.log('[analysis-status] Invalid job ID format:', jobId);
        return NextResponse.json({ 
          success: false,
          error: "Invalid job ID format" 
        }, { status: 400 });
      }
      
      if (!jobStatus) {
        return NextResponse.json({ 
          success: false,
          error: "Job not found" 
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        jobId: jobStatus.id,
        status: jobStatus.status,
        progress: jobStatus.progress,
        result: (jobStatus as any).result || (jobStatus as any).results,
        error: jobStatus.error,
        startedAt: jobStatus.startedAt,
        completedAt: jobStatus.completedAt
      });
    }
    
    // If we have an extractionId, check the database for analysis results
    if (extractionId) {
      console.log('[analysis-status] Checking database for extractionId:', extractionId);
      let supabase;
      try {
        supabase = supabaseAdmin();
        console.log('[analysis-status] Supabase admin client created successfully');
      } catch (supabaseError) {
        console.error('[analysis-status] Failed to create supabase admin client:', supabaseError);
        return NextResponse.json({ 
          success: false,
          error: "Database connection failed" 
        }, { status: 500 });
      }
      const { data: extraction, error } = await supabase
        .from('event_extractions')
        .select('payload')
        .eq('id', extractionId)
        .single();
      
      if (error) {
        return NextResponse.json({ 
          success: false,
          error: "Extraction not found" 
        }, { status: 404 });
      }
      
      const payload = extraction.payload as any;
      
      return NextResponse.json({
        success: true,
        extractionId,
        analysisStatus: payload.analysis_status || 'unknown',
        analysisJobId: payload.async_analysis_job_id,
        analysisResults: payload.analysis_results,
        analysisError: payload.analysis_error,
        speakersFound: payload.speakers_found || 0,
        crawlStats: payload.crawl_stats,
        analysisStartedAt: payload.analysis_started_at,
        analyzedAt: payload.analyzed_at
      });
    }
    
    return NextResponse.json({ 
      success: false,
      error: "Invalid request" 
    }, { status: 400 });
    
  } catch (e: any) {
    console.error('Analysis status API error:', e);
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to get analysis status" 
    }, { status: 500 });
  }
}
