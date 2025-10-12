/**
 * Debug API endpoint to test Phase 2 event pipeline with LLM enhancement
 */

import { NextResponse } from 'next/server';
import { executeNewPipeline } from '@/lib/event-pipeline';

export async function GET() {
  try {
    console.log('[debug] Testing Phase 2 event pipeline with LLM enhancement...');
    
    const result = await executeNewPipeline({
      userText: 'legal compliance conference 2025',
      country: 'DE',
      dateFrom: undefined,
      dateTo: undefined,
      locale: 'de'
    });
    
    console.log('[debug] Phase 2 pipeline result:', {
      eventCount: result.events?.length || 0,
      provider: result.provider,
      hasMetrics: !!result.pipeline_metrics,
      hasLogs: !!result.logs
    });
    
    // Analyze Phase 2 specific features
    const phase2Analysis = {
      totalEvents: result.events?.length || 0,
      llmEnhancedEvents: result.events?.filter((e: any) => 
        e.pipeline_metadata?.parseMethod === 'llm_enhanced'
      ).length || 0,
      schemaValidatedEvents: result.events?.filter((e: any) => 
        e.pipeline_metadata?.schemaValidated === true
      ).length || 0,
      averageConfidence: result.pipeline_metrics?.averageConfidence || 0,
      extractionStageLogs: result.logs?.filter((log: any) => 
        log.stage === 'extraction'
      ) || []
    };
    
    return NextResponse.json({
      success: true,
      result,
      phase2Analysis,
      summary: {
        totalEvents: result.events?.length || 0,
        provider: result.provider,
        hasResults: (result.events?.length || 0) > 0,
        sampleEvents: result.events?.slice(0, 3).map((e: any) => ({
          title: e.title,
          url: e.source_url,
          confidence: e.confidence,
          source: e.pipeline_metadata?.source,
          parseMethod: e.pipeline_metadata?.parseMethod,
          schemaValidated: e.pipeline_metadata?.schemaValidated,
          llmEnhanced: e.pipeline_metadata?.llmEnhanced
        })) || [],
        pipelineMetrics: result.pipeline_metrics,
        logs: result.logs?.slice(0, 10) // First 10 log entries
      }
    });
  } catch (error) {
    console.error('[debug] Phase 2 pipeline test failed:', error);
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
