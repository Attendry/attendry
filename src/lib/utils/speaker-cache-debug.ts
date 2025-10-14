/**
 * Speaker Cache Debug Utilities
 * 
 * Development utilities to help debug speaker cache issues
 */

import { SpeakerData } from '@/lib/types/core';
import { 
  getSpeakerCacheStats, 
  clearAllEnhancedSpeakers, 
  clearCachedSpeaker,
  hasCachedSpeaker,
  getCachedEnhancedSpeaker
} from '@/lib/hooks/useSpeakerEnhancement';
import { createSpeakerKey } from './speaker-data-normalizer';

/**
 * Debug speaker cache for a specific speaker
 */
export function debugSpeakerCache(speaker: SpeakerData): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('debugSpeakerCache is only available in development');
    return;
  }

  const speakerKey = createSpeakerKey(speaker);
  const cachedData = getCachedEnhancedSpeaker(speaker);
  const hasCache = hasCachedSpeaker(speaker);
  const stats = getSpeakerCacheStats();

  console.group(`🔍 Speaker Cache Debug: ${speaker.name}`);
  console.log('Speaker Key:', speakerKey);
  console.log('Has Cache:', hasCache);
  console.log('Cached Data:', cachedData);
  console.log('Cache Stats:', stats);
  console.groupEnd();
}

/**
 * Clear cache for a specific speaker
 */
export function clearSpeakerCache(speaker: SpeakerData): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('clearSpeakerCache is only available in development');
    return;
  }

  clearCachedSpeaker(speaker);
  console.log(`✅ Cleared cache for speaker: ${speaker.name}`);
}

/**
 * Clear all speaker caches
 */
export function clearAllSpeakerCaches(): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('clearAllSpeakerCaches is only available in development');
    return;
  }

  clearAllEnhancedSpeakers();
  console.log('✅ Cleared all speaker caches');
}

/**
 * Log all cached speakers
 */
export function logAllCachedSpeakers(): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('logAllCachedSpeakers is only available in development');
    return;
  }

  const stats = getSpeakerCacheStats();
  console.group('📋 All Cached Speakers');
  console.log('Total cached speakers:', stats.size);
  console.log('Cache keys:', stats.keys);
  console.groupEnd();
}

// Make functions available globally in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).debugSpeakerCache = debugSpeakerCache;
  (window as any).clearSpeakerCache = clearSpeakerCache;
  (window as any).clearAllSpeakerCaches = clearAllSpeakerCaches;
  (window as any).logAllCachedSpeakers = logAllCachedSpeakers;
}
