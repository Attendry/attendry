import { NextResponse } from 'next/server';
import { executeEnhancedSearch } from '@/common/search/enhanced-orchestrator';

export async function GET() {
  try {
    console.log('Testing /api/events/run logic...');
    
    const result = await executeEnhancedSearch({
      userText: 'legal conference 2025',
      country: 'DE',
      dateFrom: null,
      dateTo: null,
      locale: 'de'
    });
    
    console.log('ExecuteSearch result:', result);
    
    return NextResponse.json({
      success: true,
      result,
      summary: {
        totalEvents: result.events.length,
        providersTried: result.providersTried,
        hasResults: result.events.length > 0,
        sampleEvents: result.events.slice(0, 3).map(e => ({ title: e.title, url: e.source_url }))
      }
    });
  } catch (error) {
    console.error('ExecuteSearch test failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
