import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { speakerName } = await req.json();
    
    if (!speakerName) {
      return NextResponse.json({ error: 'Speaker name is required' }, { status: 400 });
    }

    // Test the search APIs directly
    const geminiKey = process.env.GEMINI_API_KEY;
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    const googleKey = process.env.GOOGLE_CSE_KEY;
    const googleCx = process.env.GOOGLE_CSE_CX;

    const searchQuery = `"${speakerName}" linkedin profile bio professional background`;
    
    let firecrawlResults = [];
    let cseResults = [];
    let firecrawlError = null;
    let cseError = null;

    // Test Firecrawl
    if (firecrawlKey) {
      try {
        const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 5,
            searchOptions: {
              includeHtml: false,
              onlyMainContent: true
            }
          })
        });
        
        if (firecrawlResponse.ok) {
          const firecrawlData = await firecrawlResponse.json();
          firecrawlResults = firecrawlData.data || [];
        } else {
          firecrawlError = `Firecrawl failed: ${firecrawlResponse.status} ${firecrawlResponse.statusText}`;
        }
      } catch (error) {
        firecrawlError = `Firecrawl error: ${error}`;
      }
    }

    // Test Google CSE
    if (googleKey && googleCx) {
      try {
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}&num=5`;
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          cseResults = searchData.items || [];
        } else {
          cseError = `CSE failed: ${searchResponse.status} ${searchResponse.statusText}`;
        }
      } catch (error) {
        cseError = `CSE error: ${error}`;
      }
    }

    return NextResponse.json({
      speakerName,
      searchQuery,
      environment: {
        geminiKey: !!geminiKey,
        firecrawlKey: !!firecrawlKey,
        googleKey: !!googleKey,
        googleCx: !!googleCx
      },
      results: {
        firecrawl: {
          count: firecrawlResults.length,
          results: firecrawlResults.slice(0, 2).map((r: any) => ({ title: r.title, url: r.url, content: r.content?.substring(0, 200) })),
          error: firecrawlError
        },
        cse: {
          count: cseResults.length,
          results: cseResults.slice(0, 2).map((r: any) => ({ title: r.title, url: r.link, snippet: r.snippet?.substring(0, 200) })),
          error: cseError
        }
      }
    });

  } catch (error) {
    console.error('Test enhancement error:', error);
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}
