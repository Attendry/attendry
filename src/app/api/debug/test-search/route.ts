import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/debug/test-search
 * 
 * Debug endpoint to test search without any caching.
 * This bypasses all cache mechanisms to force fresh API calls.
 */
export async function POST(req: NextRequest) {
  try {
    const { q = "", country = "de", from = "2025-09-23", to = "2025-10-23" } = await req.json();
    
    // Get Google Custom Search Engine API credentials
    const key = process.env.GOOGLE_CSE_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    
    if (!key || !cx) {
      return NextResponse.json({
        error: "Missing API keys",
        hasKey: !!key,
        hasCx: !!cx
      }, { status: 400 });
    }
    
    // Build a simple search query
    const testQuery = q || "(legal OR compliance OR investigation OR \"e-discovery\" OR ediscovery)";
    
    // Test API call with minimal parameters
    const testParams = new URLSearchParams({
      q: "test",
      key,
      cx,
      num: "1",
      safe: "off",
      hl: "en"
    });
    
    const testUrl = `https://www.googleapis.com/customsearch/v1?${testParams}`;
    console.log(JSON.stringify({ at: "debug_test", test_call: testUrl }));
    
    const testRes = await fetch(testUrl, { cache: "no-store" });
    const testData = await testRes.json();
    
    console.log(JSON.stringify({ 
      at: "debug_test", 
      test_status: testRes.status, 
      test_items: testData.items?.length || 0,
      test_error: testData.error?.message || null
    }));
    
    if (testRes.status !== 200) {
      return NextResponse.json({
        error: "Test API call failed",
        status: testRes.status,
        response: testData
      }, { status: testRes.status });
    }
    
    // Real search call
    const searchParams = new URLSearchParams({
      q: testQuery,
      key,
      cx,
      num: "10",
      safe: "off",
      hl: "en"
    });
    
    // Add country restriction if specified
    if (country === "de") {
      searchParams.set("cr", "countryDE");
      searchParams.set("gl", "de");
      searchParams.set("lr", "lang_de|lang_en");
    }
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?${searchParams}`;
    console.log(JSON.stringify({ at: "debug_test", real_call: searchUrl }));
    
    const searchRes = await fetch(searchUrl, { cache: "no-store" });
    const searchData = await searchRes.json();
    
    console.log(JSON.stringify({ 
      at: "debug_test", 
      real_status: searchRes.status, 
      real_items: searchData.items?.length || 0,
      real_error: searchData.error?.message || null
    }));
    
    return NextResponse.json({
      success: true,
      test: {
        status: testRes.status,
        items: testData.items?.length || 0,
        error: testData.error?.message || null
      },
      search: {
        status: searchRes.status,
        items: searchData.items?.length || 0,
        error: searchData.error?.message || null,
        query: testQuery,
        url: searchUrl
      },
      raw_response: searchData
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
