import { NextResponse } from 'next/server';
import { executeNewPipeline } from '@/lib/event-pipeline';
import { isNewPipelineEnabled } from '@/lib/event-pipeline/config';

export async function GET() {
  try {
    console.log('[debug] Testing pipeline with detailed output...');
    
    if (!isNewPipelineEnabled()) {
      return NextResponse.json({
        success: false,
        error: 'Pipeline not enabled'
      });
    }
    
    const result = await executeNewPipeline({
      userText: 'legal compliance conference 2025',
      country: 'DE',
      dateFrom: undefined,
      dateTo: undefined,
      locale: 'de'
    });
    
    console.log('[debug] Raw pipeline result:', JSON.stringify(result, null, 2));
    
    return NextResponse.json({
      success: true,
      rawResult: result,
      analysis: {
        hasEvents: !!result.events,
        eventCount: result.events?.length || 0,
        provider: result.provider,
        hasMetrics: !!result.pipeline_metrics,
        hasLogs: !!result.logs,
        eventsStructure: result.events ? {
          isArray: Array.isArray(result.events),
          firstEvent: result.events[0] || null,
          eventKeys: result.events[0] ? Object.keys(result.events[0]) : []
        } : null,
        metricsStructure: result.pipeline_metrics ? Object.keys(result.pipeline_metrics) : null
      }
    });
  } catch (error) {
    console.error('[debug] Detailed pipeline test failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
