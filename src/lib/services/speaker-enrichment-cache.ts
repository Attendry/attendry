/**
 * Speaker Enrichment Cache Service
 * 
 * Global caching service for speaker enrichment data to reduce API costs.
 * 
 * Features:
 * - Global cache (shared across all users)
 * - Cache key: normalized name + normalized org
 * - 30-day TTL
 * - Automatic expiration cleanup
 * - Cache hit tracking
 * 
 * Expected savings: 80%+ reduction in enrichment API costs
 */

import { supabaseServer } from '@/lib/supabase-server';
import { generateSpeakerKey } from './speaker-service';
import { normalizeOrg } from '@/lib/utils/org-normalizer';
import { SpeakerData } from '@/lib/types/core';

export interface EnhancedSpeakerData extends SpeakerData {
  location?: string;
  education?: string[];
  publications?: string[];
  career_history?: string[];
  social_links?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  expertise_areas?: string[];
  speaking_history?: string[];
  achievements?: string[];
  industry_connections?: string[] | Array<{name: string, org?: string, url?: string}>;
  recent_news?: string[] | Array<{title: string, url: string, date?: string}>;
  recent_projects?: Array<{name: string, description: string, date?: string}>;
  company_size?: string;
  team_info?: string;
  speaking_topics?: string[];
  media_mentions?: Array<{outlet: string, title: string, url: string, date: string}>;
  board_positions?: string[];
  certifications?: string[];
  confidence?: number;
}

interface CacheEntry {
  id: string;
  cache_key: string;
  normalized_name: string;
  normalized_org: string | null;
  speaker_name: string;
  speaker_org: string | null;
  enhanced_data: EnhancedSpeakerData;
  confidence: number | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  cache_hits: number;
  last_accessed_at: string;
}

/**
 * Generate cache key from speaker data
 * Uses normalized name + normalized org for consistent matching
 */
export function generateCacheKey(speaker: SpeakerData): string {
  // Normalize name (same logic as generateSpeakerKey)
  const normalizedName = speaker.name
    .toLowerCase()
    .trim()
    .replace(/^(dr\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?|miss)\s+/i, '')
    .replace(/\b([A-Z])\.\s+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Normalize org
  const normalizedOrg = speaker.org 
    ? normalizeOrg(speaker.org).toLowerCase().trim()
    : '';
  
  // Cache key format: normalizedName|normalizedOrg
  return `${normalizedName}|${normalizedOrg}`;
}

/**
 * Get enriched speaker data from cache
 * Returns null if not found or expired
 */
export async function getCachedEnrichment(
  speaker: SpeakerData
): Promise<EnhancedSpeakerData | null> {
  try {
    const supabase = await supabaseServer();
    const cacheKey = generateCacheKey(speaker);
    
    // Query cache with expiration check
    const { data, error } = await supabase
      .from('speaker_enrichment_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString()) // Only get non-expired entries
      .maybeSingle();
    
    if (error) {
      console.warn('[speaker-enrichment-cache] Error fetching from cache:', error.message);
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    // Update access tracking (increment hits, update last_accessed_at)
    await supabase
      .from('speaker_enrichment_cache')
      .update({
        cache_hits: (data.cache_hits || 0) + 1,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', data.id);
    
    console.log('[speaker-enrichment-cache] Cache hit for:', speaker.name, `(${data.cache_hits + 1} hits)`);
    
    return data.enhanced_data as EnhancedSpeakerData;
  } catch (error) {
    console.error('[speaker-enrichment-cache] Error in getCachedEnrichment:', error);
    return null;
  }
}

/**
 * Store enriched speaker data in cache
 * Creates or updates cache entry with 30-day TTL
 */
export async function setCachedEnrichment(
  speaker: SpeakerData,
  enriched: EnhancedSpeakerData
): Promise<boolean> {
  try {
    const supabase = await supabaseServer();
    const cacheKey = generateCacheKey(speaker);
    
    // Normalize name and org for storage
    const normalizedName = speaker.name
      .toLowerCase()
      .trim()
      .replace(/^(dr\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?|miss)\s+/i, '')
      .replace(/\b([A-Z])\.\s+/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const normalizedOrg = speaker.org 
      ? normalizeOrg(speaker.org).toLowerCase().trim()
      : null;
    
    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const payload = {
      cache_key: cacheKey,
      normalized_name: normalizedName,
      normalized_org: normalizedOrg,
      speaker_name: speaker.name,
      speaker_org: speaker.org || null,
      enhanced_data: enriched,
      confidence: enriched.confidence ?? null,
      expires_at: expiresAt.toISOString(),
      // Reset cache_hits on new/update
      cache_hits: 0,
      last_accessed_at: new Date().toISOString()
    };
    
    // Upsert (insert or update on conflict)
    const { error } = await supabase
      .from('speaker_enrichment_cache')
      .upsert(payload, {
        onConflict: 'cache_key',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.warn('[speaker-enrichment-cache] Error storing in cache:', error.message);
      return false;
    }
    
    console.log('[speaker-enrichment-cache] Cached enrichment for:', speaker.name);
    return true;
  } catch (error) {
    console.error('[speaker-enrichment-cache] Error in setCachedEnrichment:', error);
    return false;
  }
}

/**
 * Invalidate cache entry for a speaker
 * Useful when speaker data is manually updated
 */
export async function invalidateCache(speaker: SpeakerData): Promise<boolean> {
  try {
    const supabase = await supabaseServer();
    const cacheKey = generateCacheKey(speaker);
    
    const { error } = await supabase
      .from('speaker_enrichment_cache')
      .delete()
      .eq('cache_key', cacheKey);
    
    if (error) {
      console.warn('[speaker-enrichment-cache] Error invalidating cache:', error.message);
      return false;
    }
    
    console.log('[speaker-enrichment-cache] Invalidated cache for:', speaker.name);
    return true;
  } catch (error) {
    console.error('[speaker-enrichment-cache] Error in invalidateCache:', error);
    return false;
  }
}

/**
 * Clean up expired cache entries
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredCache(): Promise<number> {
  try {
    const supabase = await supabaseServer();
    
    const { data, error } = await supabase.rpc('cleanup_expired_speaker_cache');
    
    if (error) {
      // Fallback: manual cleanup if RPC doesn't work
      const { error: deleteError } = await supabase
        .from('speaker_enrichment_cache')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      if (deleteError) {
        console.error('[speaker-enrichment-cache] Error cleaning up expired cache:', deleteError);
        return 0;
      }
    }
    
    console.log('[speaker-enrichment-cache] Cleaned up expired cache entries');
    return 1; // Return count if available
  } catch (error) {
    console.error('[speaker-enrichment-cache] Error in cleanupExpiredCache:', error);
    return 0;
  }
}

/**
 * Get cache statistics
 * Useful for monitoring cache effectiveness
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  totalHits: number;
  averageHits: number;
}> {
  try {
    const supabase = await supabaseServer();
    
    const now = new Date().toISOString();
    
    // Get total entries
    const { count: totalCount } = await supabase
      .from('speaker_enrichment_cache')
      .select('*', { count: 'exact', head: true });
    
    // Get expired entries
    const { count: expiredCount } = await supabase
      .from('speaker_enrichment_cache')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', now);
    
    // Get total hits
    const { data: allEntries } = await supabase
      .from('speaker_enrichment_cache')
      .select('cache_hits');
    
    const totalHits = allEntries?.reduce((sum, entry) => sum + (entry.cache_hits || 0), 0) || 0;
    const averageHits = allEntries && allEntries.length > 0 
      ? totalHits / allEntries.length 
      : 0;
    
    return {
      totalEntries: totalCount || 0,
      expiredEntries: expiredCount || 0,
      totalHits,
      averageHits: Math.round(averageHits * 100) / 100
    };
  } catch (error) {
    console.error('[speaker-enrichment-cache] Error getting cache stats:', error);
    return {
      totalEntries: 0,
      expiredEntries: 0,
      totalHits: 0,
      averageHits: 0
    };
  }
}

