/**
 * PHASE 1: Cost Optimization Service (V2 - Gap 8)
 * 
 * Implements shared query cache and cost tracking to reduce API costs
 * and enable batch processing for scalability.
 */

import { supabaseServer } from '@/lib/supabase-server';
import crypto from 'crypto';

export interface CacheEntry {
  query_hash: string;
  query_text: string;
  region: string | null;
  results: any;
  cached_at: string;
  expires_at: string;
  hit_count: number;
}

export interface CostTracking {
  user_id?: string;
  discovery_run_id?: string;
  api_calls: number;
  cost_estimate: number;
  cache_hits: number;
  cache_savings: number;
  run_date: string;
}

export class CostOptimizationService {
  // Cache TTL: 24 hours
  private static readonly CACHE_TTL_HOURS = 24;

  // Estimated API costs per call (in USD)
  private static readonly ESTIMATED_COST_PER_CALL = 0.001; // $0.001 per API call

  /**
   * Generate cache key hash from query and region
   */
  static hashQuery(query: string, region: string | null = null): string {
    const keyString = `${query}|${region || ''}`;
    return crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 32);
  }

  /**
   * Check shared cache for query results
   */
  static async getCachedResults(
    query: string,
    region: string | null = null
  ): Promise<any | null> {
    try {
      const supabase = await supabaseServer();
      const queryHash = this.hashQuery(query, region);

      const { data: cacheEntry, error } = await supabase
        .from('shared_query_cache')
        .select('*')
        .eq('query_hash', queryHash)
        .eq('region', region || '')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !cacheEntry) {
        return null;
      }

      // Increment hit count
      await supabase
        .from('shared_query_cache')
        .update({ hit_count: (cacheEntry.hit_count || 0) + 1 })
        .eq('id', cacheEntry.id);

      return cacheEntry.results;
    } catch (error) {
      console.error('[cost-optimization] Error getting cached results:', error);
      return null;
    }
  }

  /**
   * Store query results in shared cache
   */
  static async cacheResults(
    query: string,
    region: string | null,
    results: any
  ): Promise<void> {
    try {
      const supabase = await supabaseServer();
      const queryHash = this.hashQuery(query, region);

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.CACHE_TTL_HOURS);

      await supabase
        .from('shared_query_cache')
        .upsert({
          query_hash: queryHash,
          query_text: query,
          region: region || null,
          results,
          expires_at: expiresAt.toISOString(),
          hit_count: 0
        }, {
          onConflict: 'query_hash,region'
        });
    } catch (error) {
      console.error('[cost-optimization] Error caching results:', error);
    }
  }

  /**
   * Track cost for a discovery run
   */
  static async trackCost(tracking: CostTracking): Promise<void> {
    try {
      const supabase = await supabaseServer();

      await supabase
        .from('discovery_cost_tracking')
        .insert({
          user_id: tracking.user_id || null,
          discovery_run_id: tracking.discovery_run_id || null,
          api_calls: tracking.api_calls,
          cost_estimate: tracking.cost_estimate,
          cache_hits: tracking.cache_hits,
          cache_savings: tracking.cache_savings,
          run_date: tracking.run_date || new Date().toISOString().split('T')[0]
        });
    } catch (error) {
      console.error('[cost-optimization] Error tracking cost:', error);
    }
  }

  /**
   * Calculate estimated cost for API calls
   */
  static calculateCost(apiCalls: number): number {
    return apiCalls * this.ESTIMATED_COST_PER_CALL;
  }

  /**
   * Calculate cache savings
   */
  static calculateCacheSavings(cacheHits: number): number {
    return this.calculateCost(cacheHits);
  }

  /**
   * Get cost summary for a user
   */
  static async getUserCostSummary(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalApiCalls: number;
    totalCost: number;
    totalCacheHits: number;
    totalSavings: number;
    cacheHitRate: number;
  }> {
    try {
      const supabase = await supabaseServer();

      let query = supabase
        .from('discovery_cost_tracking')
        .select('api_calls, cost_estimate, cache_hits, cache_savings')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('run_date', startDate);
      }
      if (endDate) {
        query = query.lte('run_date', endDate);
      }

      const { data: records, error } = await query;

      if (error || !records) {
        return {
          totalApiCalls: 0,
          totalCost: 0,
          totalCacheHits: 0,
          totalSavings: 0,
          cacheHitRate: 0
        };
      }

      const totalApiCalls = records.reduce((sum, r) => sum + (r.api_calls || 0), 0);
      const totalCost = records.reduce((sum, r) => sum + parseFloat(r.cost_estimate || '0'), 0);
      const totalCacheHits = records.reduce((sum, r) => sum + (r.cache_hits || 0), 0);
      const totalSavings = records.reduce((sum, r) => sum + parseFloat(r.cache_savings || '0'), 0);

      const cacheHitRate = totalApiCalls > 0
        ? (totalCacheHits / (totalApiCalls + totalCacheHits)) * 100
        : 0;

      return {
        totalApiCalls,
        totalCost,
        totalCacheHits,
        totalSavings,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100
      };
    } catch (error) {
      console.error('[cost-optimization] Error getting cost summary:', error);
      return {
        totalApiCalls: 0,
        totalCost: 0,
        totalCacheHits: 0,
        totalSavings: 0,
        cacheHitRate: 0
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  static async cleanupExpiredCache(): Promise<number> {
    try {
      const supabase = await supabaseServer();

      const { data, error } = await supabase.rpc('cleanup_expired_cache');

      if (error) {
        console.error('[cost-optimization] Error cleaning up cache:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('[cost-optimization] Exception cleaning up cache:', error);
      return 0;
    }
  }
}

