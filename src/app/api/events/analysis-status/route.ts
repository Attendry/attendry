import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// GET /api/events/analysis-status?jobId=xxx - Check async analysis status
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const extractionId = searchParams.get('extractionId');
    
    if (!jobId && !extractionId) {
      return NextResponse.json({ 
        success: false,
        error: "Either jobId or extractionId is required" 
      }, { status: 400 });
    }
    
    // If we have a jobId, check the async job status
    if (jobId) {
      const { getAsyncAnalysisStatus } = await import('@/lib/async-calendar-analysis');
      const jobStatus = await getAsyncAnalysisStatus(jobId);
      
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
        result: jobStatus.result,
        error: jobStatus.error,
        startedAt: jobStatus.startedAt,
        completedAt: jobStatus.completedAt
      });
    }
    
    // If we have an extractionId, check the database for analysis results
    if (extractionId) {
      const supabase = await supabaseServer();
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
