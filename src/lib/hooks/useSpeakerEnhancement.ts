/**
 * Custom hook for managing speaker enhancement state and persistence
 * 
 * This hook provides a centralized way to manage enhanced speaker data
 * that persists across component unmounts and navigation.
 */

import { useState, useEffect, useCallback } from 'react';
import { SpeakerData } from '@/lib/types/core';
import { normalizeSpeakerData, createSpeakerKey } from '@/lib/utils/speaker-data-normalizer';

export interface EnhancedSpeaker extends SpeakerData {
  title?: string;
  organization?: string;
  location?: string;
  education?: string[];
  expertise_areas?: string[];
  achievements?: string[];
  industry_connections?: Array<{ name: string; org?: string; url?: string }>;
  recent_news?: Array<{ title: string; url: string; date?: string }>;
  recent_projects?: Array<{ name: string; description: string; date?: string }>;
  company_size?: string;
  team_info?: string;
  speaking_topics?: string[];
  media_mentions?: Array<{ outlet: string; title: string; url: string; date: string }>;
  board_positions?: string[];
  certifications?: string[];
  confidence?: number;
  enhanced_at?: string;
  cached?: boolean;
}

interface UseSpeakerEnhancementResult {
  enhancedSpeaker: EnhancedSpeaker | null;
  enhancing: boolean;
  enhancementError: string | null;
  cached: boolean;
  enhanceSpeaker: () => Promise<void>;
  clearEnhancement: () => void;
  hasEnhancedData: boolean;
}

// Global cache for enhanced speaker data
const globalSpeakerCache = new Map<string, EnhancedSpeaker>();

/**
 * Generate a unique key for a speaker using the normalizer
 */
function generateSpeakerKey(speaker: SpeakerData): string {
  const normalizedSpeaker = normalizeSpeakerData(speaker);
  return createSpeakerKey(normalizedSpeaker);
}

/**
 * Custom hook for speaker enhancement
 */
export function useSpeakerEnhancement(speaker: SpeakerData): UseSpeakerEnhancementResult {
  const speakerKey = generateSpeakerKey(speaker);
  
  // Debug logging to help identify cache key issues
  if (process.env.NODE_ENV === 'development') {
    console.log('useSpeakerEnhancement:', {
      speakerName: speaker.name,
      speakerKey,
      cachedData: globalSpeakerCache.get(speakerKey)?.name
    });
  }
  
  // Initialize state from global cache if available
  const [enhancedSpeaker, setEnhancedSpeaker] = useState<EnhancedSpeaker | null>(
    globalSpeakerCache.get(speakerKey) || null
  );
  const [enhancing, setEnhancing] = useState(false);
  const [enhancementError, setEnhancementError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  // Update global cache when enhanced speaker changes
  useEffect(() => {
    if (enhancedSpeaker) {
      globalSpeakerCache.set(speakerKey, enhancedSpeaker);
    }
  }, [enhancedSpeaker, speakerKey]);

  // Check if speaker has enhanced data
  const hasEnhancedData = Boolean(
    enhancedSpeaker && (
      enhancedSpeaker.education?.length ||
      enhancedSpeaker.expertise_areas?.length ||
      enhancedSpeaker.achievements?.length ||
      enhancedSpeaker.industry_connections?.length ||
      enhancedSpeaker.recent_news?.length ||
      enhancedSpeaker.location ||
      (enhancedSpeaker.title && enhancedSpeaker.title !== speaker.title) ||
      (enhancedSpeaker.organization && enhancedSpeaker.organization !== speaker.org)
    )
  );

  /**
   * Enhance speaker with AI
   */
  const enhanceSpeaker = useCallback(async () => {
    if (enhancing || enhancedSpeaker) return;
    
    setEnhancing(true);
    setEnhancementError(null);
    
    try {
      const res = await fetch("/api/speakers/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker }),
      });
      const j = await res.json();
      
      if (!res.ok) {
        throw new Error(j.error || "Enhancement failed");
      }
      
      const enhanced = {
        ...j.enhanced,
        enhanced_at: new Date().toISOString(),
        cached: Boolean(j.cached)
      };
      
      // Safety check: ensure the enhanced data is for the correct speaker
      if (enhanced.name && enhanced.name !== speaker.name) {
        console.warn('Enhanced data name mismatch:', {
          expected: speaker.name,
          received: enhanced.name,
          speakerKey
        });
      }
      
      setEnhancedSpeaker(enhanced);
      setCached(Boolean(j.cached));
      
      // Store in global cache
      globalSpeakerCache.set(speakerKey, enhanced);
      
    } catch (e: unknown) {
      setEnhancementError((e as Error)?.message || "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  }, [speaker, enhancing, enhancedSpeaker, speakerKey]);

  /**
   * Clear enhancement data
   */
  const clearEnhancement = useCallback(() => {
    setEnhancedSpeaker(null);
    setEnhancementError(null);
    setCached(false);
    globalSpeakerCache.delete(speakerKey);
  }, [speakerKey]);

  return {
    enhancedSpeaker,
    enhancing,
    enhancementError,
    cached,
    enhanceSpeaker,
    clearEnhancement,
    hasEnhancedData
  };
}

/**
 * Get enhanced speaker from cache without hook
 */
export function getCachedEnhancedSpeaker(speaker: SpeakerData): EnhancedSpeaker | null {
  const speakerKey = generateSpeakerKey(speaker);
  return globalSpeakerCache.get(speakerKey) || null;
}

/**
 * Clear all cached enhanced speakers
 */
export function clearAllEnhancedSpeakers(): void {
  globalSpeakerCache.clear();
}

/**
 * Clear cached data for a specific speaker
 */
export function clearCachedSpeaker(speaker: SpeakerData): void {
  const speakerKey = generateSpeakerKey(speaker);
  globalSpeakerCache.delete(speakerKey);
  if (process.env.NODE_ENV === 'development') {
    console.log('Cleared cache for speaker:', speaker.name, 'key:', speakerKey);
  }
}

/**
 * Check if a speaker has cached data
 */
export function hasCachedSpeaker(speaker: SpeakerData): boolean {
  const speakerKey = generateSpeakerKey(speaker);
  return globalSpeakerCache.has(speakerKey);
}

/**
 * Get cache statistics
 */
export function getSpeakerCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: globalSpeakerCache.size,
    keys: Array.from(globalSpeakerCache.keys())
  };
}
