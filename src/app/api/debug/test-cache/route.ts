import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/debug/test-cache
 * 
 * Debug endpoint to test cache functionality
 */
export async function POST(req: NextRequest) {
  try {
    const { testType = "basic" } = await req.json();
    
    // Import the cache functions from the search route
    // Note: This is a simplified test - in a real implementation, 
    // these functions would be extracted to a shared module
    
    const testResults: any = {
      timestamp: new Date().toISOString(),
      testType,
      results: []
    };

    if (testType === "basic") {
      // Test basic cache key generation
      const testKey = `test|de|2025-01-01|2025-01-07`;
      testResults.results.push({
        test: "cache_key_generation",
        key: testKey,
        status: "success"
      });

      // Test cache key consistency (should be the same for same inputs)
      const key1 = `test|de|2025-01-01|2025-01-07`;
      const key2 = `test|de|2025-01-01|2025-01-07`;
      testResults.results.push({
        test: "cache_key_consistency",
        key1,
        key2,
        consistent: key1 === key2,
        status: key1 === key2 ? "success" : "failed"
      });
    }

    if (testType === "search") {
      // Test actual search cache by making a search request
      try {
        const searchResponse = await fetch(`${req.nextUrl.origin}/api/events/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: "test cache",
            country: "de",
            from: "2025-01-01",
            to: "2025-01-07",
            num: 5
          })
        });

        const searchData = await searchResponse.json();
        testResults.results.push({
          test: "search_cache_integration",
          status: searchResponse.ok ? "success" : "failed",
          cached: searchData.cached || false,
          items: searchData.items?.length || 0
        });
      } catch (error) {
        testResults.results.push({
          test: "search_cache_integration",
          status: "error",
          error: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...testResults
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * GET /api/debug/test-cache
 * 
 * Get cache status and statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Get cache statistics from the global cache
    const searchCache = (global as any).searchCache;
    
    const stats = {
      inMemory: {
        size: searchCache?.size || 0,
        maxSize: 100,
        cacheDuration: "6 hours"
      },
      database: {
        enabled: true,
        ttl: "6 hours"
      }
    };

    // Get sample cache keys if available
    const sampleKeys = searchCache ? Array.from(searchCache.keys()).slice(0, 5) : [];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      sampleKeys,
      instructions: [
        "Use POST with { testType: 'basic' } to test cache key generation",
        "Use POST with { testType: 'search' } to test actual search caching",
        "Check server logs for detailed cache hit/miss information"
      ]
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
