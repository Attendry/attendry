/**
 * Debug API endpoint to test the new event pipeline
 */

import { NextResponse } from 'next/server';
import { executeNewPipeline } from '@/lib/event-pipeline';

export async function GET() {
  try {
    console.log('[debug] Testing new event pipeline...');
    
    const result = await executeNewPipeline({
      userText: 'legal compliance conference 2025',
      country: 'DE',
      dateFrom: undefined,
      dateTo: undefined,
      locale: 'de'
    });
    
    console.log('[debug] New pipeline result:', {
      eventCount: result.events?.length || 0,
      provider: result.provider,
      hasMetrics: !!result.pipeline_metrics,
      hasLogs: !!result.logs
    });
    
    return NextResponse.json({
      success: true,
      result,
      summary: {
        totalEvents: result.events?.length || 0,
        provider: result.provider,
        hasResults: (result.events?.length || 0) > 0,
        sampleEvents: result.events?.slice(0, 3).map((e: any) => ({
          title: e.title,
          url: e.source_url,
          confidence: e.confidence,
          source: e.pipeline_metadata?.source
        })) || [],
        pipelineMetrics: result.pipeline_metrics,
        logs: result.logs?.slice(0, 5) // First 5 log entries
      }
    });
  } catch (error) {
    console.error('[debug] New pipeline test failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
