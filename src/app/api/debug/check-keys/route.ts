import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const keys = {
      FIRECRAWL_API_KEY: {
        exists: !!process.env.FIRECRAWL_API_KEY,
        length: process.env.FIRECRAWL_API_KEY?.length || 0,
        startsWith: process.env.FIRECRAWL_API_KEY?.substring(0, 8) || 'N/A'
      },
      GOOGLE_CSE_KEY: {
        exists: !!process.env.GOOGLE_CSE_KEY,
        length: process.env.GOOGLE_CSE_KEY?.length || 0,
        startsWith: process.env.GOOGLE_CSE_KEY?.substring(0, 8) || 'N/A'
      },
      GOOGLE_API_KEY: {
        exists: !!process.env.GOOGLE_API_KEY,
        length: process.env.GOOGLE_API_KEY?.length || 0,
        startsWith: process.env.GOOGLE_API_KEY?.substring(0, 8) || 'N/A'
      },
      GOOGLE_CSE_CX: {
        exists: !!process.env.GOOGLE_CSE_CX,
        length: process.env.GOOGLE_CSE_CX?.length || 0,
        startsWith: process.env.GOOGLE_CSE_CX?.substring(0, 8) || 'N/A'
      }
    };

    const summary = {
      firecrawlConfigured: keys.FIRECRAWL_API_KEY.exists,
      googleCseConfigured: (keys.GOOGLE_CSE_KEY.exists || keys.GOOGLE_API_KEY.exists) && keys.GOOGLE_CSE_CX.exists,
      totalConfigured: Object.values(keys).filter(k => k.exists).length,
      recommendations: []
    };

    if (!keys.FIRECRAWL_API_KEY.exists) {
      summary.recommendations.push('Set FIRECRAWL_API_KEY in Vercel environment variables');
    }
    
    if (!keys.GOOGLE_CSE_KEY.exists && !keys.GOOGLE_API_KEY.exists) {
      summary.recommendations.push('Set GOOGLE_CSE_KEY or GOOGLE_API_KEY in Vercel environment variables');
    }
    
    if (!keys.GOOGLE_CSE_CX.exists) {
      summary.recommendations.push('Set GOOGLE_CSE_CX (Custom Search Engine ID) in Vercel environment variables');
    }

    return NextResponse.json({
      keys,
      summary,
      note: 'This endpoint shows which API keys are configured. Never expose actual keys in production!'
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
