/**
 * Debug API endpoint to test Phase 3 event pipeline with full publishing
 */

import { NextResponse } from 'next/server';
import { executeNewPipeline } from '@/lib/event-pipeline';

export async function GET() {
  try {
    console.log('[debug] Testing Phase 3 event pipeline with full publishing...');
    
    const result = await executeNewPipeline({
      userText: 'legal compliance conference 2025',
      country: 'DE',
      dateFrom: undefined,
      dateTo: undefined,
      locale: 'de'
    });
    
    console.log('[debug] Phase 3 pipeline result:', {
      eventCount: result.events?.length || 0,
      provider: result.provider,
      hasMetrics: !!result.pipeline_metrics,
      hasLogs: !!result.logs
    });
    
    // Analyze Phase 3 specific features
    const phase3Analysis = {
      totalEvents: result.events?.length || 0,
      publishedEvents: result.events?.filter((e: any) => 
        e.pipeline_metadata?.publishTimestamp
      ).length || 0,
      qualityControlledEvents: result.events?.filter((e: any) => 
        e.pipeline_metadata?.qualityScore > 0.7
      ).length || 0,
      llmEnhancedEvents: result.events?.filter((e: any) => 
        e.pipeline_metadata?.llmEnhanced === true
      ).length || 0,
      schemaValidatedEvents: result.events?.filter((e: any) => 
        e.pipeline_metadata?.schemaValidated === true
      ).length || 0,
      averageConfidence: result.pipeline_metrics?.averageConfidence || 0,
      averageQualityScore: result.events?.reduce((sum: number, e: any) => 
        sum + (e.pipeline_metadata?.qualityScore || 0), 0) / (result.events?.length || 1) || 0,
      publishingStageLogs: result.logs?.filter((log: any) => 
        log.stage === 'publishing'
      ) || []
    };
    
    return NextResponse.json({
      success: true,
      result,
      phase3Analysis,
      summary: {
        totalEvents: result.events?.length || 0,
        provider: result.provider,
        hasResults: (result.events?.length || 0) > 0,
        sampleEvents: result.events?.slice(0, 3).map((e: any) => ({
          title: e.title,
          url: e.source_url,
          confidence: e.confidence,
          confidence_reason: e.confidence_reason,
          source: e.pipeline_metadata?.source,
          parseMethod: e.pipeline_metadata?.parseMethod,
          schemaValidated: e.pipeline_metadata?.schemaValidated,
          llmEnhanced: e.pipeline_metadata?.llmEnhanced,
          qualityScore: e.pipeline_metadata?.qualityScore,
          publishTimestamp: e.pipeline_metadata?.publishTimestamp
        })) || [],
        pipelineMetrics: result.pipeline_metrics,
        logs: result.logs?.slice(0, 15) // First 15 log entries
      }
    });
  } catch (error) {
    console.error('[debug] Phase 3 pipeline test failed:', error);
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
