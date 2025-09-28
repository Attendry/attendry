import { NextResponse } from 'next/server';
import { executeSearch } from '@/common/search/orchestrator';

export async function GET() {
  try {
    console.log('Testing full search pipeline...');
    
    const result = await executeSearch({
      userText: 'legal conference 2025',
      country: 'DE',
      dateFrom: null,
      dateTo: null,
      locale: 'de'
    });
    
    console.log('Search pipeline result:', result);
    
    return NextResponse.json({
      success: true,
      result,
      summary: {
        totalUrls: result.items.length,
        providerUsed: result.providerUsed,
        providersTried: result.providersTried,
        hasResults: result.items.length > 0,
        sampleUrls: result.items.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Search pipeline test failed:', error);
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
