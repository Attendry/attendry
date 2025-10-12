import { NextResponse } from 'next/server';
import { executeNewPipeline } from '@/lib/event-pipeline';
import { isNewPipelineEnabled } from '@/lib/event-pipeline/config';

export async function GET() {
  try {
    console.log('[debug] Testing main pipeline integration...');
    
    const pipelineEnabled = isNewPipelineEnabled();
    console.log('[debug] Pipeline enabled:', pipelineEnabled);
    
    if (!pipelineEnabled) {
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
    
    console.log('[debug] Pipeline result:', {
      hasEvents: !!result.events,
      eventCount: result.events?.length || 0,
      provider: result.provider,
      hasMetrics: !!result.pipeline_metrics,
      hasLogs: !!result.logs
    });
    
    return NextResponse.json({
      success: true,
      pipelineEnabled,
      result: {
        hasEvents: !!result.events,
        eventCount: result.events?.length || 0,
        provider: result.provider,
        hasMetrics: !!result.pipeline_metrics,
        hasLogs: !!result.logs,
        sampleEvent: result.events?.[0] || null
      }
    });
  } catch (error) {
    console.error('[debug] Main pipeline test failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
