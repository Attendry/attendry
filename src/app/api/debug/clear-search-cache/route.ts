import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * POST /api/debug/clear-search-cache
 * 
 * Debug endpoint to clear search cache and force fresh API calls.
 * This helps troubleshoot when cached results are causing issues.
 */
export async function POST(req: NextRequest) {
  try {
    const { cacheKey, clearAll = false } = await req.json();
    
    // Clear in-memory cache (this only affects current server instance)
    // Note: In Vercel, each function invocation may be on a different instance
    const cleared: string[] = [];
    
    if (clearAll) {
      // Clear all cache entries
      const searchCache = (global as any).searchCache;
      if (searchCache && typeof searchCache.clear === 'function') {
        searchCache.clear();
        cleared.push('all_in_memory');
      }
    } else if (cacheKey) {
      // Clear specific cache entry
      const searchCache = (global as any).searchCache;
      if (searchCache && typeof searchCache.delete === 'function') {
        searchCache.delete(cacheKey);
        cleared.push(`specific_in_memory:${cacheKey}`);
      }
    }
    
    // Clear database cache
    try {
      const supabase = await supabaseServer();
      if (clearAll) {
        const { error } = await supabase.from('search_cache').delete().neq('id', 0);
        if (!error) cleared.push('all_database');
      } else if (cacheKey) {
        const { error } = await supabase.from('search_cache').delete().eq('cache_key', cacheKey);
        if (!error) cleared.push(`specific_database:${cacheKey}`);
      }
    } catch (error) {
      console.warn('Failed to clear database cache:', error);
    }
    
    return NextResponse.json({
      success: true,
      cleared,
      message: clearAll 
        ? 'All search cache cleared' 
        : cacheKey 
          ? `Cache cleared for key: ${cacheKey}`
          : 'No cache key provided',
      note: 'In-memory cache only affects current server instance. Database cache is persistent.'
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/debug/clear-search-cache
 * 
 * Get cache status and statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const showKeys = searchParams.get('showKeys') === 'true';
    
    const stats: any = {
      inMemory: {
        size: 0,
        keys: showKeys ? [] : undefined
      },
      database: {
        count: 0,
        keys: showKeys ? [] : undefined
      }
    };
    
    // Check in-memory cache
    const searchCache = (global as any).searchCache;
    if (searchCache && typeof searchCache.size === 'number') {
      stats.inMemory.size = searchCache.size;
      if (showKeys && typeof searchCache.keys === 'function') {
        stats.inMemory.keys = Array.from(searchCache.keys());
      }
    }
    
    // Check database cache
    try {
      const supabase = await supabaseServer();
      const { data, error } = await supabase
        .from('search_cache')
        .select('cache_key, created_at, ttl_at')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        stats.database.count = data.length;
        if (showKeys) {
          stats.database.keys = data.map(row => ({
            key: row.cache_key,
            created: row.created_at,
            expires: row.ttl_at
          }));
        }
      }
    } catch (error) {
      stats.database.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    return NextResponse.json({
      success: true,
      stats,
      cacheDuration: '6 hours',
      note: 'Use POST to clear cache entries'
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
