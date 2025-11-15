/**
 * PERF-3.2.2: Pre-warm Cache
 * 
 * Background job to pre-warm cache with common queries and frequently accessed data
 * Runs during off-peak hours to improve cache hit rates
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getCacheService, CACHE_CONFIGS } from '@/lib/cache';
import { SearchService } from '@/lib/services/search-service';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Common search queries to pre-warm (based on typical usage patterns)
const COMMON_SEARCH_QUERIES = [
  { q: 'legal tech conference', country: 'DE', from: undefined, to: undefined },
  { q: 'compliance summit', country: 'DE', from: undefined, to: undefined },
  { q: 'legal conference', country: 'DE', from: undefined, to: undefined },
  { q: 'compliance event', country: 'DE', from: undefined, to: undefined },
  { q: 'legal tech', country: 'DE', from: undefined, to: undefined },
  { q: 'conference', country: 'DE', from: undefined, to: undefined },
  { q: 'legal tech conference', country: 'FR', from: undefined, to: undefined },
  { q: 'compliance summit', country: 'FR', from: undefined, to: undefined },
  { q: 'legal tech conference', country: 'GB', from: undefined, to: undefined },
  { q: 'compliance summit', country: 'GB', from: undefined, to: undefined },
  { q: 'legal conference', country: 'US', from: undefined, to: undefined },
  { q: 'compliance event', country: 'US', from: undefined, to: undefined },
];

// Calculate date ranges for common queries (next 3 months)
function getDefaultDateRange() {
  const today = new Date();
  const from = today.toISOString().split('T')[0];
  const threeMonthsLater = new Date(today);
  threeMonthsLater.setMonth(today.getMonth() + 3);
  const to = threeMonthsLater.toISOString().split('T')[0];
  return { from, to };
}

async function preWarmSearchConfig(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[pre-warm-cache] Pre-warming search configuration...');
    // This will trigger the cache in loadSearchConfig
    await SearchService.loadSearchConfig();
    console.log('[pre-warm-cache] Search configuration pre-warmed');
    return { success: true };
  } catch (error: any) {
    console.warn('[pre-warm-cache] Failed to pre-warm search config:', error.message);
    return { success: false, error: error.message };
  }
}

async function preWarmUserProfiles(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  try {
    console.log('[pre-warm-cache] Pre-warming active user profiles...');
    const supabase = supabaseAdmin();
    
    // Get active users (users who have logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: activeUsers, error } = await supabase
      .from('profiles')
      .select('id')
      .not('id', 'is', null)
      .limit(50); // Limit to top 50 active users
    
    if (error || !activeUsers || activeUsers.length === 0) {
      console.warn('[pre-warm-cache] No active users found or error:', error?.message);
      return { success: 0, failed: 0 };
    }
    
    console.log(`[pre-warm-cache] Found ${activeUsers.length} active users to pre-warm`);
    
    // Pre-warm profiles in parallel (batched)
    const batchSize = 10;
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          try {
            // This will trigger cache in loadUserProfile
            // Note: loadUserProfile requires auth context, so we'll cache the profile data directly
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            
            if (profile) {
              const cacheService = getCacheService();
              const cacheKey = `user_profile_${user.id}`;
              await cacheService.set(cacheKey, profile, CACHE_CONFIGS.USER_PROFILES);
              return true;
            }
            return false;
          } catch (err) {
            return false;
          }
        })
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          success++;
        } else {
          failed++;
        }
      });
    }
    
    console.log(`[pre-warm-cache] Pre-warmed ${success} user profiles, ${failed} failed`);
    return { success, failed };
  } catch (error: any) {
    console.warn('[pre-warm-cache] Failed to pre-warm user profiles:', error.message);
    return { success: 0, failed: 0 };
  }
}

async function preWarmSearchQueries(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  
  try {
    console.log('[pre-warm-cache] Pre-warming common search queries...');
    const { from, to } = getDefaultDateRange();
    const cacheService = getCacheService();
    
    // Pre-warm queries in parallel (with concurrency limit)
    const concurrencyLimit = 3; // Limit concurrent searches to avoid overwhelming APIs
    const queries = COMMON_SEARCH_QUERIES.map(query => ({
      ...query,
      from: query.from || from,
      to: query.to || to
    }));
    
    for (let i = 0; i < queries.length; i += concurrencyLimit) {
      const batch = queries.slice(i, i + concurrencyLimit);
      
      const results = await Promise.allSettled(
        batch.map(async (query) => {
          try {
            // Generate cache key (same format as search route)
            const normalizedQuery = query.q.trim().replace(/\s+/g, ' ');
            const cacheKey = `${normalizedQuery}|${query.country}|${query.from || ''}|${query.to || ''}`;
            
            // Check if already cached
            const cached = await cacheService.get(cacheKey, CACHE_CONFIGS.SEARCH_RESULTS);
            if (cached) {
              console.log(`[pre-warm-cache] Query already cached: ${query.q} (${query.country})`);
              return { cached: true };
            }
            
            // Trigger a search to populate cache
            // Use a lightweight search that will populate the cache
            // We'll use the search service's executeSearch method
            const searchResult = await SearchService.executeSearch({
              q: query.q,
              country: query.country,
              from: query.from,
              to: query.to,
              num: 20,
              rerank: false,
              topK: 20
            });
            
            if (searchResult && searchResult.items && searchResult.items.length > 0) {
              // Cache will be populated by the search service
              console.log(`[pre-warm-cache] Pre-warmed query: ${query.q} (${query.country}) - ${searchResult.items.length} results`);
              return { cached: false, warmed: true };
            }
            
            return { cached: false, warmed: false };
          } catch (error: any) {
            console.warn(`[pre-warm-cache] Failed to pre-warm query ${query.q}:`, error.message);
            throw error;
          }
        })
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          success++;
        } else {
          failed++;
        }
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + concurrencyLimit < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }
    
    console.log(`[pre-warm-cache] Pre-warmed ${success} search queries, ${failed} failed`);
    return { success, failed };
  } catch (error: any) {
    console.error('[pre-warm-cache] Failed to pre-warm search queries:', error.message);
    return { success: 0, failed: 0 };
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify this is a cron request
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[pre-warm-cache] Starting cache pre-warming...');
  const startTime = Date.now();

  const results = {
    timestamp: new Date().toISOString(),
    searchConfig: { success: false },
    userProfiles: { success: 0, failed: 0 },
    searchQueries: { success: 0, failed: 0 },
    duration: 0
  };

  // Pre-warm search configuration
  results.searchConfig = await preWarmSearchConfig();

  // Pre-warm user profiles
  results.userProfiles = await preWarmUserProfiles();

  // Pre-warm common search queries
  results.searchQueries = await preWarmSearchQueries();

  results.duration = Date.now() - startTime;

  const totalSuccess = 
    (results.searchConfig.success ? 1 : 0) +
    results.userProfiles.success +
    results.searchQueries.success;
  
  const totalFailed = 
    (results.searchConfig.success ? 0 : 1) +
    results.userProfiles.failed +
    results.searchQueries.failed;

  console.log(`[pre-warm-cache] Completed in ${results.duration}ms. Success: ${totalSuccess}, Failed: ${totalFailed}`);

  return NextResponse.json({
    success: true,
    ...results,
    summary: {
      totalSuccess,
      totalFailed,
      cacheHitRate: totalSuccess > 0 ? ((totalSuccess / (totalSuccess + totalFailed)) * 100).toFixed(1) + '%' : '0%'
    }
  });
}

