import { NextResponse } from 'next/server';
import { search as firecrawlSearch } from '@/providers/firecrawl';
import { search as cseSearch } from '@/providers/cse';

export async function GET() {
  try {
    const testQuery = 'legal conference 2025';
    
    console.log('Testing providers with query:', testQuery);
    
    // Test Firecrawl
    console.log('Testing Firecrawl...');
    const firecrawlResult = await firecrawlSearch({ q: testQuery });
    console.log('Firecrawl result:', firecrawlResult);
    
    // Test CSE
    console.log('Testing CSE...');
    const cseResult = await cseSearch({ q: testQuery });
    console.log('CSE result:', cseResult);
    
    return NextResponse.json({
      query: testQuery,
      firecrawl: firecrawlResult,
      cse: cseResult,
      summary: {
        firecrawlUrls: firecrawlResult.items?.length || 0,
        cseUrls: cseResult.items?.length || 0,
        totalUrls: (firecrawlResult.items?.length || 0) + (cseResult.items?.length || 0)
      }
    });
  } catch (error) {
    console.error('Provider test failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
