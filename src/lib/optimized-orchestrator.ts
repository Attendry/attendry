/**
 * Optimized Event Search Orchestrator
 * 
 * This is the consolidated, high-performance orchestrator that combines
 * the best practices from Enhanced Orchestrator and New Event Pipeline.
 * 
 * Key Features:
 * - Unified search with multiple providers (Firecrawl, CSE, Database)
 * - Intelligent prioritization using Gemini 2.5-flash
 * - Parallel processing for maximum throughput
 * - Comprehensive error recovery and circuit breakers
 * - Advanced caching and rate limiting
 * - Speaker extraction and enhancement
 * - Event metadata validation and enrichment
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { unifiedSearch } from './search/unified-search-core';
import { executeWithRetry, executeWithGracefulDegradation, executeWithCircuitBreaker } from './error-recovery';
import { supabaseServer } from './supabase-server';
import { getCountryContext } from './utils/country';
import { loadActiveConfig } from '../common/search/config';
import { buildWeightedQuery, buildWeightedGeminiContext } from './services/weighted-query-builder';
import { WEIGHTED_INDUSTRY_TEMPLATES } from './data/weighted-templates';
import { 
  getParallelProcessor, 
  processUrlDiscoveryParallel, 
  processEventExtractionParallel, 
  processSpeakerEnhancementParallel,
  createParallelTask 
} from './parallel-processor';
import { 
  OPTIMIZED_CONFIG, 
  resourceOptimizer, 
  optimizeTimeout,
  getOptimizedConcurrency,
  getOptimizedPerformance
} from './resource-optimizer';
import { 
  searchCache,
  analysisCache, 
  speakerCache, 
  generateAnalysisCacheKey, 
  generateSpeakerCacheKey,
  warmPopularSearches 
} from './advanced-cache';
import { deepCrawlEvent, extractEventMetadata, extractAndEnhanceSpeakers } from './event-analysis';
import type { SpeakerData } from './event-analysis';
import { attemptJsonRepair } from './ai/gemini-bypass';
import { 
  cacheOptimizer,
  invalidateCacheByPattern,
  getCacheAnalytics,
  getCacheWarmingStats
} from './cache-optimizer';
import { 
  isAggregatorUrl, 
  calculateUrlBonus, 
  RERANK_CONFIG,
  createRerankMetrics,
  type RerankMetrics
} from '../config/rerank';
import { parseWithRepair } from './llm/json';
import { filterSpeakers, type RawSpeaker } from './extract/speakers';
import { SearchCfg } from '../config/search';
import {
  computeQuality,
  isSolidHit,
  extractHost,
  type CandidateMeta,
  type QualityWindow
} from './quality/eventQuality';
import {
  computeExpandedWindow,
  shouldAutoExpand,
  type Window
} from './search/autoExpand';
import { applyVoyageGate } from './search/voyageGate';
import { 
  performanceMonitor,
  recordApiPerformance,
  recordCachePerformance,
  recordExternalPerformance,
  getPerformanceSnapshot,
  getPerformanceTrends,
  getPerformanceRecommendations,
  getPerformanceAlerts
} from './performance-monitor';

// Environment variables
const geminiKey = process.env.GEMINI_API_KEY;
const firecrawlKey = process.env.FIRECRAWL_KEY;
const geminiModelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';
const geminiModelId = geminiModelPath
  .split('/')
  .pop()
  ?.replace(':generateContent', '') || 'gemini-2.5-flash';
const geminiPrioritizationModelId =
  process.env.GEMINI_PRIORITIZATION_MODEL || geminiModelId;

const AGGREGATOR_HOSTS = new Set([
  '10times.com',
  'allconferencealert.com',
  'conferencealerts.co.in',
  'conferenceineurope.net',
  'conferenceineurope.org',
  'eventbrite.com',
  'eventbrite.de',
  'eventbrite.co.uk',
  'freeconferencealerts.com',
  'globalli.io',
  'internationalconferencealerts.com',
  'linkedin.com',
  'researchbunny.com',
  'vendelux.com',
  'conference-service.com',
  'conference2go.com',           // NEW - generic aggregator
  'eventora.com',
  'eventsworld.com',
  'globalriskcommunity.com',
  'cvent.com'
]);

type GenerativeModel = ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

const GEMINI_PRIORITIZATION_SCHEMA = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    properties: {
      url: { type: 'string' },
      score: { type: 'number' },
      reason: { type: 'string' }
    },
    required: ['url', 'score']
  }
};

let geminiPrioritizationModel: GenerativeModel | null = null;

function parseGeminiPrioritizationPayload(rawText: string): any[] {
  const candidates: any[] = [];

  const tryParse = (text: string): any[] | null => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === 'object') {
        const arrayKey = Object.keys(parsed).find((key) => Array.isArray((parsed as any)[key]));
        if (arrayKey) {
          return parsed[arrayKey];
        }
      }
    } catch (error) {
      return null;
    }
    return null;
  };

  const direct = tryParse(rawText);
  if (direct) {
    return direct;
  }

  const trimmed = rawText.trim();
  if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
    const repairedTail = tryParse(trimmed + ']');
    if (repairedTail) {
      return repairedTail;
    }
  }

  // Try to find the first JSON array in the text
  const arrayMatch = rawText.match(/\[[\s\S]*]/);
  if (arrayMatch) {
    const arrayParsed = tryParse(arrayMatch[0]);
    if (arrayParsed) {
      return arrayParsed;
    }
  }

  // Attempt JSON repair helper
  const repaired = attemptJsonRepair(rawText);
  if (repaired.success && Array.isArray(repaired.data)) {
    return repaired.data;
  }
  if (repaired.success && repaired.data && typeof repaired.data === 'object') {
    const arrayKey = Object.keys(repaired.data).find((key) => Array.isArray((repaired.data as any)[key]));
    if (arrayKey) {
      return repaired.data[arrayKey];
    }
  }

  // Try to parse individual objects even if the array is truncated
  const objectMatches = rawText.match(/\{[\s\S]*?\}(?=,|\s*\]|$)/g);
  if (objectMatches && objectMatches.length > 0) {
    const repairedObjects = objectMatches.map((chunk) => {
      const repaired = attemptJsonRepair(chunk);
      if (repaired.success && repaired.data && typeof repaired.data === 'object') {
        return repaired.data;
      }
      try {
        return JSON.parse(chunk);
      } catch {
        return null;
      }
    }).filter(Boolean) as any[];

    if (repairedObjects.length > 0) {
      return repairedObjects;
    }
  }

  return candidates;
}

// Rate limiter for Gemini API calls
const geminiRateLimiter = {
  lastCall: 0,
  minInterval: 1000, // 1 second between calls
  
  async waitIfNeeded() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    if (timeSinceLastCall < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
    }
    this.lastCall = Date.now();
  }
};

// Performance metrics tracking
const geminiMetrics = {
  totalCalls: 0,
  successfulCalls: 0,
  timeoutCalls: 0,
  errorCalls: 0,
  averageResponseTime: 0,
  lastCallTime: 0,
  
  recordCall(success: boolean, responseTime: number, errorType?: string) {
    this.totalCalls++;
    this.lastCallTime = Date.now();
    
    if (success) {
      this.successfulCalls++;
    } else {
      if (errorType === 'timeout') {
        this.timeoutCalls++;
      } else {
        this.errorCalls++;
      }
    }
    
    // Update average response time
    this.averageResponseTime = this.averageResponseTime === 0 
      ? responseTime 
      : (this.averageResponseTime + responseTime) / 2;
  },
  
  getMetrics() {
    return {
      totalCalls: this.totalCalls,
      successRate: this.totalCalls > 0 ? (this.successfulCalls / this.totalCalls * 100).toFixed(1) + '%' : '0%',
      timeoutRate: this.totalCalls > 0 ? (this.timeoutCalls / this.totalCalls * 100).toFixed(1) + '%' : '0%',
      errorRate: this.totalCalls > 0 ? (this.errorCalls / this.totalCalls * 100).toFixed(1) + '%' : '0%',
      averageResponseTime: Math.round(this.averageResponseTime) + 'ms',
      lastCallTime: this.lastCallTime
    };
  }
};

/**
 * Get Gemini API performance metrics
 */
export function getGeminiMetrics() {
  return geminiMetrics.getMetrics();
}

/**
 * Get user profile for industry-specific context
 */
async function getUserProfile(): Promise<any> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    
    if (!userRes?.user) {
      return null;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userRes.user.id)
      .single();

    return data;
  } catch (error) {
    console.warn('Failed to get user profile:', error);
    return null;
  }
}

/**
 * Get search configuration for industry-specific context
 */
async function getSearchConfig(): Promise<any> {
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase
      .from('search_configurations')
      .select('*')
      .eq('is_active', true)
      .single();

    return data;
  } catch (error) {
    console.warn('Failed to get search config:', error);
    return null;
  }
}

// Configuration - Using optimized settings
const ORCHESTRATOR_CONFIG = {
  thresholds: {
    prioritization: 0.4,    // Minimum score to proceed from prioritization
    confidence: 0.6,        // Minimum confidence to publish
    parseQuality: 0.5,      // Minimum parse quality
  },
  limits: {
    maxCandidates: 40,      // Increased from 30 for better coverage
    maxExtractions: 12,     // Reduced from 20 to 12 to prevent timeout
    maxSpeakers: 30,        // Increased from 25 for richer data
  },
  timeouts: {
    discovery: optimizeTimeout('firecrawl'),      // Optimized timeout
    prioritization: OPTIMIZED_CONFIG.timeouts.prioritization,
    extraction: OPTIMIZED_CONFIG.timeouts.extraction,
    enhancement: OPTIMIZED_CONFIG.timeouts.enhancement,
  },
  parallel: {
    maxConcurrentExtractions: Math.min(getOptimizedConcurrency().maxConcurrentExtractions, 4),
    maxConcurrentEnhancements: Math.min(getOptimizedConcurrency().maxConcurrentEnhancements, 3),
    maxConcurrentDiscoveries: getOptimizedConcurrency().maxConcurrentDiscoveries,
    enableSmartBatching: getOptimizedPerformance().enableSmartBatching,
    enableEarlyTermination: getOptimizedPerformance().enableEarlyTermination,
  }
};

// Types
export interface OptimizedSearchParams {
  userText: string;
  country: string | null;
  dateFrom?: string;
  dateTo?: string;
  location?: string | null;
  timeframe?: string | null;
  locale?: string;
}

export interface EventCandidate {
  url: string;
  title?: string;
  description?: string;
  date?: string;
  location?: string;
  venue?: string;
  speakers?: SpeakerInfo[];
  sponsors?: SponsorInfo[];
  confidence: number;
  source: 'firecrawl' | 'cse' | 'database';
  dateRangeSource?: 'original' | '2-weeks' | '1-month';  // Track which date range found this event
  metadata: {
    originalQuery: string;
    country: string | null;
    processingTime: number;
    stageTimings: {
      discovery?: number;
      prioritization?: number;
      extraction?: number;
      enhancement?: number;
    };
    analysis?: {
      organizer?: string;
      website?: string;
      registrationUrl?: string;
      pagesCrawled?: number;
      totalContentLength?: number;
    };
  };
}

export interface SpeakerInfo {
  name: string;
  title?: string;
  company?: string;
}

export interface SponsorInfo {
  name: string;
  level?: string;
  description?: string;
}

export interface OptimizedSearchResult {
  events: EventCandidate[];
  metadata: {
    totalCandidates: number;
    prioritizedCandidates: number;
    extractedCandidates: number;
    enhancedCandidates: number;
    totalDuration: number;
    averageConfidence: number;
    sourceBreakdown: Record<string, number>;
    providersUsed: string[];
    performance?: {
      stageTimings: Record<string, number>;
      resourceUtilization: {
        memoryUsage: number;
        cpuUsage: number;
        activeRequests: number;
      };
      optimizationEnabled: boolean;
      parallelProcessing: {
        enabled: boolean;
        maxConcurrency: number;
        adaptiveScaling: boolean;
      };
      cacheAnalytics?: {
        searchHitRate: number;
        analysisHitRate: number;
        speakerHitRate: number;
        totalCacheHits: number;
        totalCacheSize: number;
        memoryUsage: number;
        optimizationEnabled: boolean;
        warmingStats?: {
          totalWarmed: number;
          successfulWarms: number;
          failedWarms: number;
          lastWarmingTime: number;
        };
        optimizationAnalytics?: {
          timestamp: number;
          hitRate: number;
          missRate: number;
          totalRequests: number;
          averageResponseTime: number;
          cacheSize: number;
          memoryUsage: number;
          topKeys: Array<{ key: string; hits: number; size: number }>;
          invalidationCount: number;
          warmingCount: number;
        };
      };
    };
    performanceMonitoring?: {
      enabled: boolean;
      snapshot: {
        timestamp: number;
        metrics: Array<{
          id: string;
          timestamp: number;
          type: string;
          name: string;
          value: number;
          unit: string;
          tags: Record<string, string>;
        }>;
        summary: {
          totalRequests: number;
          averageResponseTime: number;
          errorRate: number;
          cacheHitRate: number;
          memoryUsage: number;
          cpuUsage: number;
        };
      };
      trends: Array<{
        metric: string;
        period: string;
        trend: 'improving' | 'stable' | 'degrading';
        change: number;
        confidence: number;
        prediction?: number;
      }>;
      recommendations: Array<{
        id: string;
        type: string;
        priority: string;
        title: string;
        description: string;
        impact: string;
        effort: string;
        metrics: string[];
        implementation: string[];
      }>;
      activeAlerts: Array<{
        id: string;
        timestamp: number;
        severity: string;
        type: string;
        metric: string;
        value: number;
        threshold: number;
        message: string;
        recommendations: string[];
        resolved: boolean;
      }>;
      monitoringEnabled: boolean;
    };
  };
  logs: Array<{
    stage: string;
    message: string;
    timestamp: string;
    data?: any;
  }>;
}

/**
 * Main optimized search function
 */
export async function executeOptimizedSearch(params: OptimizedSearchParams): Promise<OptimizedSearchResult> {
  const startTime = Date.now();
  const logs: OptimizedSearchResult['logs'] = [];
  
  // Register request with resource optimizer
  resourceOptimizer.registerRequest();
  
  // Record search start
  const searchStartTime = Date.now();
  recordApiPerformance('optimized_search_start', 0, true, { 
    userText: params.userText?.substring(0, 50) || 'empty',
    country: params.country || 'unknown'
  });
  
  // Warm popular searches in background
  warmPopularSearches().catch(error => {
    console.warn('[optimized-orchestrator] Cache warming failed:', error);
  });
  
  try {
    // Step 1: Load user profile for personalized search
    const userProfileStart = Date.now();
    const userProfile = await getUserProfile();
    const userProfileTime = Date.now() - userProfileStart;
    
    if (userProfile) {
      console.log('[optimized-orchestrator] User profile loaded:', {
        industryTerms: userProfile.industry_terms?.length || 0,
        icpTerms: userProfile.icp_terms?.length || 0,
        competitors: userProfile.competitors?.length || 0
      });
    }
    
    // Step 2: Build optimized query with user profile
    const queryBuildStart = Date.now();
    const query = await buildOptimizedQuery(params, userProfile);
    const queryBuildTime = Date.now() - queryBuildStart;
    logs.push({
      stage: 'query_build',
      message: 'Built optimized search query with user profile',
      timestamp: new Date().toISOString(),
      data: { 
        query: query.substring(0, 100) + '...', 
        duration: queryBuildTime,
        userProfileLoaded: !!userProfile,
        userProfileDuration: userProfileTime
      }
    });

    // Step 3: Multi-source discovery
    const discoveryStart = Date.now();
    const rawCandidates = await discoverEventCandidates(query, params, userProfile);
    const discoveryTime = Date.now() - discoveryStart;
    logs.push({
      stage: 'discovery',
      message: `Discovered ${rawCandidates.length} raw candidates`,
      timestamp: new Date().toISOString(),
      data: { candidateCount: rawCandidates.length, duration: discoveryTime }
    });

    // Step 3.5: Voyage rerank gate (pre-filter aggregators, apply DE bias)
    const voyageStart = Date.now();
    const voyageResult = await applyVoyageGate(
      rawCandidates,
      {
        country: params.country || 'DE',
        dateFrom: params.dateFrom || '',
        dateTo: params.dateTo || '',
        industry: userProfile?.industry_terms?.[0] || params.userText
      },
      process.env.VOYAGE_API_KEY
    );
    const candidates = voyageResult.urls;
    const voyageTime = Date.now() - voyageStart;

    logs.push({
      stage: 'rerank',
      message: `Voyage gate: ${rawCandidates.length} → ${candidates.length} URLs`,
      timestamp: new Date().toISOString(),
      data: {
        ...voyageResult.metrics,
        duration: voyageTime
      }
    });

    console.log('[optimized-orchestrator] Voyage gate metrics:', voyageResult.metrics);

    // Step 3.7: Filter out obvious non-event URLs (documentation, PDFs, profile pages, generic listings)
    const filteredCandidates = candidates.filter(url => {
      const urlLower = url.toLowerCase();
      
      // Exclude documentation pages
      if (urlLower.includes('/docs/') || urlLower.includes('/documentation/')) return false;
      
      // Exclude PDFs and other documents
      if (urlLower.endsWith('.pdf') || urlLower.endsWith('.doc') || urlLower.endsWith('.docx')) return false;
      
      // Exclude profile/people pages
      if (urlLower.includes('/people/') || urlLower.includes('/person/') || urlLower.includes('/profile/')) return false;
      
      // Exclude legal/static pages
      if (urlLower.includes('/privacy') || urlLower.includes('/terms') || urlLower.includes('/impressum') || urlLower.includes('/agb')) return false;
      
      // Exclude generic event listing pages (aggregator-like) - only if URL ends with /events/ or /events
      // Allow specific event URLs like /events/event-name-2025
      const endsWithEvents = urlLower.endsWith('/events/') || urlLower.endsWith('/events');
      if (endsWithEvents) {
        console.log(`[url-filter] Excluding generic events listing: ${url}`);
        return false;
      }
      
      // Exclude Microsoft Learn documentation (not events)
      if (urlLower.includes('learn.microsoft.com') && urlLower.includes('/purview/')) return false;
      
      // Exclude State Department budget documents
      if (urlLower.includes('state.gov') && urlLower.includes('/wp-content/uploads/')) return false;
      
      return true;
    });
    
    if (filteredCandidates.length < candidates.length) {
      console.log(`[url-filter] Filtered ${candidates.length} → ${filteredCandidates.length} URLs (removed ${candidates.length - filteredCandidates.length} non-event pages)`);
      logs.push({
        stage: 'url_filter',
        message: `Filtered out ${candidates.length - filteredCandidates.length} non-event URLs`,
        timestamp: new Date().toISOString(),
        data: { before: candidates.length, after: filteredCandidates.length }
      });
    }

    // Step 4: Intelligent prioritization (now on pre-filtered URLs)
    const prioritizationStart = Date.now();
    const prioritized = await prioritizeCandidates(filteredCandidates, params);
    const prioritizationTime = Date.now() - prioritizationStart;
    logs.push({
      stage: 'prioritization',
      message: `Prioritized ${prioritized.length} candidates`,
      timestamp: new Date().toISOString(),
      data: { prioritizedCount: prioritized.length, duration: prioritizationTime }
    });

    // Step 5: Parallel extraction
    const extractionStart = Date.now();
    let extracted = await extractEventDetails(prioritized, params);
    
    // Tag events with original date range
    extracted.forEach(event => {
      event.dateRangeSource = 'original';
    });
    
    const extractionTime = Date.now() - extractionStart;
    logs.push({
      stage: 'extraction',
      message: `Extracted ${extracted.length} events`,
      timestamp: new Date().toISOString(),
      data: { extractedCount: extracted.length, duration: extractionTime }
    });
    
    // Step 5.3: Quality scoring and solid-hit gate
    const qualityStart = Date.now();
    const window: QualityWindow = {
      from: params.dateFrom || '',
      to: params.dateTo || ''
    };

    const scoredEvents = extracted.map(event => {
      const meta: CandidateMeta = {
        url: event.url,
        host: extractHost(event.url),
        country: event.country || undefined,
        dateISO: event.date,
        venue: event.venue || undefined,
        city: event.city || undefined,
        speakersCount: event.speakers?.length || 0,
        hasSpeakerPage: (event.metadata?.analysis?.pagesCrawled || 0) > 1,
        textSample: event.description?.substring(0, 500)
      };
      
      const qualityResult = isSolidHit(meta, window);
      
      // Log why events fail quality check
      if (!qualityResult.ok) {
        console.log(`[quality-gate] Filtered: "${event.title?.substring(0, 60)}" | Quality: ${qualityResult.quality.toFixed(2)} | ` +
          `Date: ${meta.dateISO || 'missing'} | City: ${meta.city || 'missing'} | Speakers: ${meta.speakersCount} | ` +
          `Country: ${meta.country || extractHost(event.url)}`);
      }
      
      return {
        event,
        ...qualityResult
      };
    });

    // Filter to only solid hits
    const solidEvents = scoredEvents.filter(s => s.ok).map(s => s.event);
    const qualityTime = Date.now() - qualityStart;

    const avgQuality = scoredEvents.length > 0 
      ? scoredEvents.reduce((sum, s) => sum + s.quality, 0) / scoredEvents.length 
      : 0;
    
    console.log(`[orchestrator] Quality scoring: ${extracted.length} → ${solidEvents.length} solid hits (avg quality: ${avgQuality.toFixed(2)})`);
    
    // Log quality breakdown if all filtered
    if (solidEvents.length === 0 && extracted.length > 0) {
      console.warn(`[quality-gate] All ${extracted.length} events filtered! Common issues: missing dates, no German location, < 2 speakers`);
      console.warn(`[quality-gate] To fix: Ensure events have date (YYYY-MM-DD), city/venue, and ≥2 speakers`);
    }

    logs.push({
      stage: 'quality',
      message: `Quality gate: ${extracted.length} → ${solidEvents.length} solid hits`,
      timestamp: new Date().toISOString(),
      data: {
        scored: extracted.length,
        solid: solidEvents.length,
        avgQuality: avgQuality.toFixed(2),
        duration: qualityTime
      }
    });

    // Update extracted to be solid events only
    extracted = solidEvents;
    
    // Step 5.5: Auto-expand date range if insufficient solid hits
    if (shouldAutoExpand(extracted.length) && params.dateFrom && params.dateTo) {
      const prevSolidCount = extracted.length;
      const origWindow: Window = { from: params.dateFrom, to: params.dateTo };
      const expandedWindow = computeExpandedWindow(origWindow);
      
      // Only expand if window actually changed
      if (expandedWindow.to !== origWindow.to) {
        console.log(`[auto-expand] Expanding window from ${origWindow.to} to ${expandedWindow.to}`);
        logs.push({
          stage: 'auto_expand',
          message: `Auto-expanding: ${prevSolidCount} solid hits < ${SearchCfg.minSolidHits} minimum`,
          timestamp: new Date().toISOString(),
          data: {
            originalWindow: origWindow,
            expandedWindow,
            solidCountBefore: prevSolidCount
          }
        });
        
        // Re-run pipeline with expanded window
        const expandedParams = { ...params, dateTo: expandedWindow.to };
        const expandedQuery = await buildOptimizedQuery(expandedParams, userProfile);
        
        // Discovery → Voyage gate → Prioritization → Extraction → Quality
        const expandedRawCandidates = await discoverEventCandidates(expandedQuery, expandedParams, userProfile);
        const expandedVoyageResult = await applyVoyageGate(
          expandedRawCandidates,
          {
            country: expandedParams.country || 'DE',
            dateFrom: expandedWindow.from,
            dateTo: expandedWindow.to,
            industry: userProfile?.industry_terms?.[0] || expandedParams.userText
          },
          process.env.VOYAGE_API_KEY
        );
        const expandedCandidates = expandedVoyageResult.urls;
        
        // Filter out non-event URLs in expanded results (same logic as initial filter)
        const expandedFilteredCandidates = expandedCandidates.filter(url => {
          const urlLower = url.toLowerCase();
          if (urlLower.includes('/docs/') || urlLower.includes('/documentation/')) return false;
          if (urlLower.endsWith('.pdf') || urlLower.endsWith('.doc') || urlLower.endsWith('.docx')) return false;
          if (urlLower.includes('/people/') || urlLower.includes('/person/') || urlLower.includes('/profile/')) return false;
          if (urlLower.includes('/privacy') || urlLower.includes('/terms') || urlLower.includes('/impressum') || urlLower.includes('/agb')) return false;
          // Exclude generic event listing pages
          const endsWithEvents = urlLower.endsWith('/events/') || urlLower.endsWith('/events');
          if (endsWithEvents) {
            console.log(`[url-filter-expanded] Excluding generic events listing: ${url}`);
            return false;
          }
          if (urlLower.includes('learn.microsoft.com') && urlLower.includes('/purview/')) return false;
          if (urlLower.includes('state.gov') && urlLower.includes('/wp-content/uploads/')) return false;
          return true;
        });
        
        console.log(`[url-filter-expanded] Filtered ${expandedCandidates.length} → ${expandedFilteredCandidates.length} URLs`);
        
        const expandedPrioritized = await prioritizeCandidates(expandedFilteredCandidates, expandedParams);
        let expandedExtracted = await extractEventDetails(expandedPrioritized, expandedParams);
        
        // Tag expanded events
        expandedExtracted.forEach(event => {
          event.dateRangeSource = '2-weeks';
        });
        
        // Quality scoring on expanded events
        const expandedScoredEvents = expandedExtracted.map(event => {
          const meta: CandidateMeta = {
            url: event.url,
            host: extractHost(event.url),
            country: event.country || undefined,
            dateISO: event.date,
            venue: event.venue || undefined,
            city: event.city || undefined,
            speakersCount: event.speakers?.length || 0,
            hasSpeakerPage: (event.metadata?.analysis?.pagesCrawled || 0) > 1,
            textSample: event.description?.substring(0, 500)
          };
          
          return {
            event,
            ...isSolidHit(meta, expandedWindow)
          };
        });
        
        const expandedSolidEvents = expandedScoredEvents.filter(s => s.ok).map(s => s.event);
        
        // Merge unique events
        const originalUrls = new Set(extracted.map(e => e.url));
        const newEvents = expandedSolidEvents.filter(e => !originalUrls.has(e.url));
        extracted = [...extracted, ...newEvents];
        
        console.log(`[auto-expand] After expansion: ${extracted.length} total solid hits (${newEvents.length} new)`);
        logs.push({
          stage: 'auto_expand',
          message: `Expansion added ${newEvents.length} solid events`,
          timestamp: new Date().toISOString(),
          data: {
            totalSolid: extracted.length,
            newSolid: newEvents.length,
            expandedTo: expandedWindow.to
          }
        });
      }
    }

    // Step 6: Speaker enhancement
    const enhancementStart = Date.now();
    const enhanced = await enhanceEventSpeakers(extracted);
    const enhancementTime = Date.now() - enhancementStart;
    logs.push({
      stage: 'enhancement',
      message: `Enhanced ${enhanced.length} events`,
      timestamp: new Date().toISOString(),
      data: { enhancedCount: enhanced.length, duration: enhancementTime }
    });

    // Step 7: Final filtering and ranking
    const finalEvents = filterAndRankEvents(enhanced);

    const totalDuration = Date.now() - startTime;
    const averageConfidence = finalEvents.length > 0 
      ? finalEvents.reduce((sum, event) => sum + event.confidence, 0) / finalEvents.length 
      : 0;

    // Mark low confidence if we don't have enough solid hits
    const lowConfidence = extracted.length < SearchCfg.minSolidHits;
    if (lowConfidence) {
      console.warn(`[orchestrator] Low confidence: only ${extracted.length} solid hits (minimum: ${SearchCfg.minSolidHits})`);
    }

    // Record final search performance
    recordApiPerformance('optimized_search_complete', totalDuration, true, {
      eventsFound: finalEvents.length.toString(),
      averageConfidence: averageConfidence.toFixed(2),
      country: params.country || 'unknown',
      lowConfidence: lowConfidence.toString()
    });

    // Get performance metrics
    const performanceMetrics = performanceMonitor.getMetrics();
    const resourceMetrics = resourceOptimizer.getResourceMetrics();
    const cacheAnalytics = {
      search: searchCache.getAnalytics(),
      analysis: analysisCache.getAnalytics(),
      speaker: speakerCache.getAnalytics()
    };
    const cacheOptimizationAnalytics = getCacheAnalytics();
    const cacheWarmingStats = getCacheWarmingStats();
    const performanceSnapshot = getPerformanceSnapshot();
    const performanceTrends = getPerformanceTrends();
    const performanceRecommendations = getPerformanceRecommendations();
    const performanceAlerts = getPerformanceAlerts({ resolved: false });

    return {
      events: finalEvents,
      metadata: {
        totalCandidates: rawCandidates.length,
        prioritizedCandidates: prioritized.length,
        extractedCandidates: extracted.length,
        enhancedCandidates: enhanced.length,
        totalDuration,
        averageConfidence,
        lowConfidence,
        sourceBreakdown: getSourceBreakdown(finalEvents),
        providersUsed: ['firecrawl', 'cse', 'database'],
        // Performance optimization data
        performance: {
          stageTimings: {
            queryBuild: queryBuildTime,
            discovery: discoveryTime,
            prioritization: prioritizationTime,
            extraction: extractionTime,
            enhancement: enhancementTime,
            total: totalDuration,
          },
          resourceUtilization: resourceMetrics,
          optimizationEnabled: true,
          parallelProcessing: {
            enabled: true,
            maxConcurrency: getOptimizedConcurrency().maxConcurrentRequests,
            adaptiveScaling: getOptimizedConcurrency().enableAdaptiveConcurrency,
          },
          cacheAnalytics: {
            searchHitRate: cacheAnalytics.search.combined.hitRate,
            analysisHitRate: cacheAnalytics.analysis.combined.hitRate,
            speakerHitRate: cacheAnalytics.speaker.combined.hitRate,
            totalCacheHits: cacheAnalytics.search.combined.hits + cacheAnalytics.analysis.combined.hits + cacheAnalytics.speaker.combined.hits,
            totalCacheSize: cacheAnalytics.search.combined.cacheSize + cacheAnalytics.analysis.combined.cacheSize + cacheAnalytics.speaker.combined.cacheSize,
            memoryUsage: cacheAnalytics.search.combined.memoryUsage + cacheAnalytics.analysis.combined.memoryUsage + cacheAnalytics.speaker.combined.memoryUsage,
            optimizationEnabled: true,
            warmingStats: cacheWarmingStats,
            optimizationAnalytics: cacheOptimizationAnalytics || undefined,
          }
        },
        // Performance monitoring data
        performanceMonitoring: {
          enabled: true,
          snapshot: performanceSnapshot,
          trends: performanceTrends,
          recommendations: performanceRecommendations,
          activeAlerts: performanceAlerts,
          monitoringEnabled: true,
        }
      },
      logs
    };

  } catch (error) {
    const errorDuration = Date.now() - startTime;
    
    // Record error performance
    recordApiPerformance('optimized_search_error', errorDuration, false, {
      error: error instanceof Error ? error.message : String(error),
      country: params.country || 'unknown'
    });
    
    logs.push({
      stage: 'error',
      message: 'Search failed',
      timestamp: new Date().toISOString(),
      data: { error: error instanceof Error ? error.message : String(error) }
    });

    return {
      events: [],
      metadata: {
        totalCandidates: 0,
        prioritizedCandidates: 0,
        extractedCandidates: 0,
        enhancedCandidates: 0,
        totalDuration: Date.now() - startTime,
        averageConfidence: 0,
        sourceBreakdown: {},
        providersUsed: [],
        performance: {
          stageTimings: {},
          resourceUtilization: resourceOptimizer.getResourceMetrics(),
          optimizationEnabled: true,
          parallelProcessing: {
            enabled: true,
            maxConcurrency: getOptimizedConcurrency().maxConcurrentRequests,
            adaptiveScaling: getOptimizedConcurrency().enableAdaptiveConcurrency,
          }
        },
        // Performance monitoring data
        performanceMonitoring: {
          enabled: true,
          snapshot: getPerformanceSnapshot(),
          trends: getPerformanceTrends(),
          recommendations: getPerformanceRecommendations(),
          activeAlerts: getPerformanceAlerts({ resolved: false }),
          monitoringEnabled: true,
        }
      },
      logs
    };
  } finally {
    // Always unregister the request
    resourceOptimizer.unregisterRequest();
  }
}

/**
 * Build optimized search query using weighted templates with user profile integration
 */
async function buildOptimizedQuery(params: OptimizedSearchParams, userProfile?: any): Promise<string> {
  // Get search configuration to determine industry
  const searchConfig = await getSearchConfig();
  const industry = searchConfig?.industry || 'legal-compliance';
  
  // Get weighted template for the industry
  const template = WEIGHTED_INDUSTRY_TEMPLATES[industry];
  
  if (template) {
    // Use weighted query builder for enhanced precision
    const weightedResult = buildWeightedQuery(
      template,
      userProfile,
      params.country || 'DE',
      params.userText
    );
    
    console.log('[optimized-orchestrator] Built weighted query:', {
      industry,
      weights: weightedResult.weights,
      queryLength: weightedResult.query.length,
      negativeFilters: weightedResult.negativeFilters.length,
      geographicTerms: weightedResult.geographicTerms.length
    });
    
    return weightedResult.query;
  } else {
    // Fallback to unified query builder if no weighted template available
    const { buildUnifiedQuery } = await import('@/lib/unified-query-builder');
    
    // Build user-specific query if profile is available
    let userText = params.userText;
    if (userProfile && !userText) {
      // If no user text provided, build query from user profile
      const industryTerms = userProfile.industry_terms || [];
      const icpTerms = userProfile.icp_terms || [];
      const competitors = userProfile.competitors || [];
      
      if (industryTerms.length > 0 || icpTerms.length > 0) {
        const userContext = [];
        if (industryTerms.length > 0) {
          userContext.push(industryTerms.slice(0, 3).join(', '));
        }
        if (icpTerms.length > 0) {
          userContext.push(`targeting ${icpTerms.slice(0, 2).join(', ')}`);
        }
        if (competitors.length > 0) {
          userContext.push(`competitors: ${competitors.slice(0, 2).join(', ')}`);
        }
        
        userText = userContext.join(' ');
        console.log('[optimized-orchestrator] Built user-specific query from profile:', userText);
      }
    }
    
    const result = await buildUnifiedQuery({
      userText: userText,
      country: params.country,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      location: params.location,
      timeframe: params.timeframe,
      locale: params.locale,
      language: 'en' // Default to English for optimized orchestrator
    });
    
    return result.query;
  }
}

/**
 * Discover event candidates from multiple sources using parallel processing
 */
async function discoverEventCandidates(query: string, params: OptimizedSearchParams, userProfile?: any): Promise<string[]> {
  const startTime = Date.now();
  
  // Create multiple query variations for parallel discovery
  const queryVariations = [
    query, // Original query
    `${query} conference`, // Add conference keyword
    `${query} summit`, // Add summit keyword
    `${query} event`, // Add event keyword
  ];
  
  // Use parallel processing for multiple query variations
  const parallelProcessor = getParallelProcessor();
  const discoveryTasks = queryVariations.map((variation, index) => 
    createParallelTask(
      `discovery_${index}`,
      variation,
      0.9, // High priority for discovery
      'firecrawl'
    )
  );
  
  const discoveryResults = await parallelProcessor.processParallel(
    discoveryTasks,
    async (task) => {
      return await executeWithRetry(async () => {
        console.log('[optimized-orchestrator] Executing discovery with query:', task.data.substring(0, 100) + '...');
        const result = await unifiedSearch({
          q: task.data,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          country: params.country || undefined,
          limit: Math.ceil(ORCHESTRATOR_CONFIG.limits.maxCandidates / queryVariations.length),
          useCache: true,
          userProfile: userProfile // Pass user profile to unified search
        });
        console.log('[optimized-orchestrator] Discovery result:', { 
          query: task.data.substring(0, 50) + '...', 
          itemsFound: result.items?.length || 0,
          userProfileUsed: !!userProfile 
        });
        return result;
      }, 'firecrawl');
    },
    {
      maxConcurrency: 12, // Firecrawl supports up to 50 concurrent browsers, using 12 for optimal throughput
      enableEarlyTermination: false, // Don't terminate early for discovery
      qualityThreshold: 0.5,
      minResults: 1
    }
  );

  // Combine results from all query variations
  const allUrls: string[] = [];
  discoveryResults.forEach(result => {
    if (result.success && result.result && typeof result.result === 'object' && 'items' in result.result) {
      const searchResult = result.result as { items: string[] };
      allUrls.push(...searchResult.items);
    }
  });

  // Filter and deduplicate URLs
  const urls = allUrls
    .filter(url => typeof url === 'string' && url.startsWith('http'))
    .filter((url, index, array) => array.indexOf(url) === index) // Remove duplicates
    .slice(0, ORCHESTRATOR_CONFIG.limits.maxCandidates);

  console.log(`[optimized-orchestrator] Discovered ${urls.length} unique URLs from ${queryVariations.length} query variations in ${Date.now() - startTime}ms`);
  
  // Log parallel processing metrics
  const metrics = parallelProcessor.getMetrics();
  console.log(`[optimized-orchestrator] Discovery parallel processing metrics:`, {
    throughput: metrics.throughput.toFixed(2),
    concurrencyLevel: metrics.concurrencyLevel,
    averageDuration: metrics.averageDuration.toFixed(0),
    resourceUtilization: metrics.resourceUtilization
  });
  
  return urls;
}

/**
 * Prioritize candidates using Gemini 2.5-flash
 */
async function prioritizeCandidates(urls: string[], params: OptimizedSearchParams): Promise<Array<{url: string, score: number, reason: string}>> {
  if (urls.length === 0) return [];
  
  const startTime = Date.now();
  
  // Aggregators already filtered in Phase 3, so work with the pre-filtered URLs
  console.log(`[optimized-orchestrator] Phase 4: Prioritizing ${urls.length} pre-filtered URLs with domain bonuses...`);
  
  try {
    const prioritized = await executeWithRetry(async () => {
      return await prioritizeWithGemini(urls, params);
    }, 'gemini');

    // PHASE 4: Apply domain bonuses (.de TLD, conference paths)
    const withBonuses = prioritized.map(item => ({
      ...item,
      originalScore: item.score,
      score: item.score + calculateUrlBonus(item.url)
    }));
    
    // Re-sort by adjusted score
    withBonuses.sort((a, b) => b.score - a.score);
    
    const filtered = withBonuses.filter(item => item.score >= ORCHESTRATOR_CONFIG.thresholds.prioritization);
    
    const bonusCount = withBonuses.filter(item => item.score > item.originalScore).length;
    console.log(`[optimized-orchestrator] Prioritized ${filtered.length}/${urls.length} candidates (${bonusCount} with domain bonuses) in ${Date.now() - startTime}ms`);
    
    return filtered;
  } catch (error) {
    console.warn('[optimized-orchestrator] Prioritization failed, using enhanced fallback scoring:', error);
    
    // Enhanced fallback scoring with industry relevance
    const searchConfig = await getSearchConfig();
    const userProfile = await getUserProfile();
    const industryTerms = (userProfile?.industry_terms as string[]) || [];
    const icpTerms = (userProfile?.icp_terms as string[]) || [];
    
    return nonAggregatorUrls.map((url, idx) => {
      let score = 0.3 - idx * 0.02; // Base score with degradation
      
      const urlLower = url.toLowerCase();
      
      // Heavy boost for industry-specific terms in URL path
      let industryMatch = false;
      for (const term of industryTerms) {
        if (urlLower.includes(term.toLowerCase())) {
          score += 0.4;
          industryMatch = true;
          break;
        }
      }
      
      // Additional boost for generic industry keywords if no specific match
      if (!industryMatch) {
        if (urlLower.includes('/legal') || urlLower.includes('/compliance') || 
            urlLower.includes('/regulatory') || urlLower.includes('/ediscovery')) {
          score += 0.3;
        }
      }
      
      // Boost for specific event pages (not generic directories)
      if (/\/(event|summit|conference)\/[^\/]+/.test(url)) {
        score += 0.25;
      }
      
      // Small boost for location
      if (urlLower.includes('germany') || urlLower.includes('berlin') || urlLower.includes('munich')) {
        score += 0.05;
      }
      
      return { 
        url, 
        score: Math.max(0.1, Math.min(score, 0.9)), 
        reason: 'enhanced_fallback' 
      };
    });
  }
}

/**
 * Execute Gemini API call with proper error handling and metrics
 */
async function executeGeminiCall(prompt: string, urls: string[]): Promise<Array<{url: string, score: number, reason: string}>> {
  const startTime = Date.now();

  if (!geminiKey) {
    return urls.map((url, idx) => ({
      url,
      score: Math.max(0.8 - idx * 0.02, 0.45),
      reason: 'fallback_missing_key'
    }));
  }

  const attemptTimeouts = [12000]; // single short attempt (ms)

  try {
    const systemInstruction = 'Return only JSON array [{"url":"","score":0,"reason":""}]. Score 0-1 based on industry relevance. Prioritize URLs with specific events matching the industry focus. Penalize generic directories. Reason<=10 chars. No explanations.';

    // Lazily instantiate the prioritization model once
    if (!geminiPrioritizationModel) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      geminiPrioritizationModel = genAI.getGenerativeModel({
        model: geminiPrioritizationModelId
      });
    }

    for (let attempt = 0; attempt < attemptTimeouts.length; attempt++) {
      const timeoutMs = attemptTimeouts[attempt];

      let timeoutId: NodeJS.Timeout | null = null;
      try {
        await geminiRateLimiter.waitIfNeeded();
        console.log(`[optimized-orchestrator] Attempting Gemini prioritization with ${timeoutMs}ms timeout (attempt ${attempt + 1}/${attemptTimeouts.length})`);

        const generationConfig = {
          temperature: 0.1,
          topP: 0.7,
          topK: 20,
          candidateCount: 1,
          maxOutputTokens: 4096,  // Increased to 4096 to accommodate thinking tokens (up to 2047 observed!)
          responseMimeType: 'application/json',
          responseSchema: GEMINI_PRIORITIZATION_SCHEMA
        };

        const requestPayload = {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig,
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
          ]
        };

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Gemini prioritization timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        const result = await Promise.race([
          geminiPrioritizationModel!.generateContent(requestPayload),
          timeoutPromise
        ]) as Awaited<ReturnType<GenerativeModel['generateContent']>>;

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        const response = result?.response;
        const finishReason = response?.candidates?.[0]?.finishReason;
        const usageMetadata = (response as any)?.usageMetadata;

        const text = typeof response?.text === 'function'
          ? await response.text()
          : response?.candidates?.[0]?.content?.parts?.[0]?.text;

        console.debug('[optimized-orchestrator] Gemini prioritization finish reason:', finishReason, 'Usage:', usageMetadata);

        if (!text) {
          throw new Error(`No content in Gemini response${finishReason ? ` (finishReason: ${finishReason})` : ''}`);
        }

        const parsed = parseGeminiPrioritizationPayload(text as string);

        if (!parsed || parsed.length === 0) {
          throw new Error('Gemini prioritization response is empty or invalid');
        }

        const limited = parsed.slice(0, urls.length);

        const normalized = limited
          .map((item: any, idx: number) => {
            if (!item || typeof item.url !== 'string') {
              return null;
            }
            const rawScore = typeof item.score === 'number' ? item.score : parseFloat(item.score);
            const score = Number.isFinite(rawScore) ? Math.min(Math.max(rawScore, 0), 1) : Math.max(0.5 - idx * 0.02, 0.05);
            const reason = typeof item.reason === 'string' && item.reason.trim().length > 0 ? item.reason.trim().slice(0, 10) : 'gemini';
            return { url: item.url, score, reason };
          })
          .filter((item): item is { url: string; score: number; reason: string } => !!item)
          .filter(item => urls.includes(item.url));

        if (normalized.length === 0) {
          throw new Error('No valid prioritized URLs returned by Gemini');
        }

        const responseTime = Date.now() - startTime;
        geminiMetrics.recordCall(true, responseTime);
        console.log('[optimized-orchestrator] Successfully prioritized URLs via Gemini:', {
          attempt: attempt + 1,
          responseTime: `${responseTime}ms`,
          finishReason,
          promptLength: prompt.length,
          modelUsed: geminiPrioritizationModelId
        });

        return normalized;
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        console.warn(`[optimized-orchestrator] Gemini prioritization attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);

        if (attempt === attemptTimeouts.length - 1) {
          throw error;
        }
      }
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    let errorType = 'unknown';

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('timeout')) {
        errorType = 'timeout';
      } else if (message.includes('quota') || message.includes('rate limit')) {
        errorType = 'quota';
      } else if (message.includes('safety')) {
        errorType = 'safety';
      } else if (message.includes('invalid') || message.includes('json')) {
        errorType = 'invalid';
      } else if (message.includes('network') || message.includes('fetch')) {
        errorType = 'network';
      }

      console.warn('[optimized-orchestrator] Gemini prioritization failed, falling back:', error.message);
    } else {
      console.warn('[optimized-orchestrator] Gemini prioritization failed with unknown error, falling back:', error);
    }

    geminiMetrics.recordCall(false, responseTime, errorType);

    return urls.map((url, idx) => ({
      url,
      score: Math.max(0.8 - idx * 0.02, 0.45),
      reason: `fallback_${errorType}`
    }));
  }

  // Should never reach here, but keep TypeScript satisfied
  return urls.map((url, idx) => ({
    url,
    score: Math.max(0.8 - idx * 0.02, 0.45),
    reason: 'fallback_unknown'
  }));
}

/**
 * Prioritize URLs using Gemini 2.5-flash with Weighted Template approach
 * This uses weighted templates for enhanced precision and context
 */
async function prioritizeWithGemini(urls: string[], params: OptimizedSearchParams): Promise<Array<{url: string, score: number, reason: string}>> {
  if (!geminiKey) {
    console.warn('[optimized-orchestrator] No GEMINI_API_KEY, returning fallback scoring');
    return urls.map((url, idx) => ({ url, score: 0.4 - idx * 0.01, reason: 'api_key_missing' }));
  }

  // Get search configuration and user profile for context
  const searchConfig = await getSearchConfig();
  const userProfile = await getUserProfile();
  
  const industry = searchConfig?.industry || 'legal-compliance';
  
  // Get weighted template for enhanced context
  const template = WEIGHTED_INDUSTRY_TEMPLATES[industry];

  const countryContext = getCountryContext(params.country);
  const locationContext = countryContext.countryNames[0] || countryContext.iso2 || 'target region';

  let timeframeLabel = '';
  if (params.dateFrom && params.dateTo) {
    timeframeLabel = ` window:${params.dateFrom}->${params.dateTo}.`;
  } else if (params.dateFrom) {
    timeframeLabel = ` after:${params.dateFrom}.`;
  } else if (params.dateTo) {
    timeframeLabel = ` before:${params.dateTo}.`;
  }

  const userIndustryTerms = userProfile?.industry_terms || [];
  const userIcpTerms = userProfile?.icp_terms || [];
  const userContextParts: string[] = [];
  if (userIndustryTerms.length > 0) {
    userContextParts.push(`topics:${userIndustryTerms[0]}`);
  }
  if (userIcpTerms.length > 0) {
    userContextParts.push(`roles:${userIcpTerms[0]}`);
  }
  // Competitor context increases prompt length significantly; omit for stability.
  const userContextText = userContextParts.length > 0 ? ` ${userContextParts.join(' ')}` : '';

  const weightedContext = template
    ? buildWeightedGeminiContext(template, userProfile, urls, params.country || 'DE')
    : `Rate ${industry} events in ${locationContext}.`;

  const chunkSize = 3;  // Process 3 URLs per Gemini call (was 5) - avoids MAX_TOKENS with thinking tokens
  const baseContext = `${weightedContext}${timeframeLabel}${userContextText} Score each URL 0-1. Return JSON array: [{"url":"","score":0,"reason":""}] (reason<=10 chars, no prose).`;

  const resultsMap = new Map<string, { url: string; score: number; reason: string }>();

  const fallbackForUrl = (url: string, idx: number, reason = 'fallback') => {
    let score = 0.3 - idx * 0.02;  // Lower base score
    
    // Check if it's an aggregator domain - heavily penalize
    try {
      const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      if (AGGREGATOR_HOSTS.has(host)) {
        return { url, score: 0.05, reason: 'aggregator' };  // Very low score for aggregators
      }
    } catch {
      // keep url if parsing fails
    }
    
    // Boost for specific event pages (not just generic directories)
    const hasSpecificEvent = /\/(event|summit|conference)\/[^\/]+/.test(url);
    if (hasSpecificEvent) {
      score += 0.3;
    } else if (url.includes('conference') || url.includes('summit') || url.includes('event')) {
      score += 0.1;  // Smaller boost for generic event keywords
    }
    
    // Boost for industry-specific terms IN THE URL PATH (not just domain)
    const urlLower = url.toLowerCase();
    if (urlLower.includes('/legal') || urlLower.includes('/compliance') || urlLower.includes('/regulatory') || 
        urlLower.includes('/ediscovery') || urlLower.includes('/governance')) {
      score += 0.35;
    }
    
    // Small boost for location
    if (url.includes('de') || url.includes('germany') || url.includes('berlin') || url.includes('munich')) {
      score += 0.05;
    }
    
    return { url, score: Math.max(0.1, Math.min(score, 0.9)), reason };
  };

  const filteredUrls = urls.filter((url, idx) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      if (AGGREGATOR_HOSTS.has(host)) {
        if (!resultsMap.has(url)) {
          resultsMap.set(url, fallbackForUrl(url, idx, 'agg_skip'));
        }
        return false;
      }
    } catch {
      // keep url if parsing fails
    }
    return true;
  });

  console.log('[optimized-orchestrator] Gemini prioritization setup:', {
    industry,
    urls: urls.length,
    filtered: filteredUrls.length,
    contextLength: baseContext.length,
    chunkSize
  });

  for (let i = 0; i < filteredUrls.length; i += chunkSize) {
    const chunk = filteredUrls.slice(i, i + chunkSize);
    const numberedList = chunk.map((url, idx) => `${idx + 1}. ${url}`).join('\n');
    const prompt = `${baseContext}\nURLs:\n${numberedList}`;

    try {
      const chunkResults = await executeGeminiCall(prompt, chunk);
      chunkResults.forEach((item) => {
        if (!resultsMap.has(item.url)) {
          resultsMap.set(item.url, item);
        }
      });
    } catch (error) {
      console.warn('[optimized-orchestrator] Gemini chunk prioritization failed, applying fallback:', error instanceof Error ? error.message : error);
      chunk.forEach((url, localIdx) => {
        const globalIdx = i + localIdx;
        if (!resultsMap.has(url)) {
          resultsMap.set(url, fallbackForUrl(url, globalIdx, 'fallback_chunk_failed'));
        }
      });
    }
  }

  if (resultsMap.size === 0) {
    console.warn('[optimized-orchestrator] Gemini returned no results; using full fallback scoring');
    return urls.map((url, idx) => fallbackForUrl(url, idx, 'fallback_all_failed'));
  }

  return urls.map((url, idx) => resultsMap.get(url) ?? fallbackForUrl(url, idx, 'fallback_missing'));
}

/**
 * Extract event details from prioritized URLs
 */
async function extractEventDetails(prioritized: Array<{url: string, score: number, reason: string}>, params: OptimizedSearchParams): Promise<EventCandidate[]> {
  if (prioritized.length === 0) return [];
  
  const startTime = Date.now();
  
  // Limit the number of URLs to extract to prevent timeout (max 12)
  const limitedPrioritized = prioritized.slice(0, ORCHESTRATOR_CONFIG.limits.maxExtractions);
  
  console.log(`[optimized-orchestrator] Extracting ${limitedPrioritized.length}/${prioritized.length} URLs (limited for performance)`);
  
  // Use parallel processing for event extraction, but throttle to respect Firecrawl limits
  const parallelProcessor = getParallelProcessor();
  const extractionTasks = limitedPrioritized.map((item, index) =>
    createParallelTask(
      `extraction_${index}`,
      item.url,
      item.score,
      'firecrawl'
    )
  );

  type ExtractionPayload = {
    metadata: {
      title: string;
      description: string;
      date: string;
      location: string;
      organizer: string;
      website: string;
      registrationUrl?: string;
    };
    speakers: SpeakerData[];
    crawlStats: {
      pagesCrawled: number;
      totalContentLength: number;
      durationMs: number;
      provider: 'firecrawl' | 'cse';
    };
  } | null;

  const extractionResults = await parallelProcessor.processParallel(
    extractionTasks,
    async (task) => {
      return await executeWithRetry(async () => {
        const extractionStart = Date.now();
        const url = task.data;
        console.log('[optimized-orchestrator] Deep crawling event:', url);

        // Add timeout for individual deep crawl (30 seconds max)
        const crawlPromise = deepCrawlEvent(url);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Deep crawl timeout')), 30000)
        );
        const crawlResults = await Promise.race([crawlPromise, timeoutPromise]).catch(err => {
          console.warn('[optimized-orchestrator] Deep crawl timed out or failed:', url, err);
          return [];
        });

        if (!crawlResults || crawlResults.length === 0) {
          console.warn('[optimized-orchestrator] Deep crawl returned no content, skipping:', url);
          return null;
        }

        const totalContentLength = crawlResults.reduce((sum, result) => sum + (result.content?.length || 0), 0);
        const provider = crawlResults.some(result => result.metadata?.source === 'google_cse') ? 'cse' as const : 'firecrawl';

        let metadata;
        try {
          metadata = await extractEventMetadata(crawlResults, undefined, undefined, params.country || undefined);
        } catch (error) {
          console.warn('[optimized-orchestrator] Metadata extraction failed, using fallback:', error instanceof Error ? error.message : error);
          metadata = {
            title: crawlResults[0]?.title || 'Untitled Event',
            description: crawlResults[0]?.description || '',
            date: '',
            location: params.country || '',
            organizer: '',
            website: url,
            registrationUrl: undefined
          };
        }

        let speakers: SpeakerData[] = [];
        try {
          speakers = await extractAndEnhanceSpeakers(crawlResults);
        } catch (error) {
          console.warn('[optimized-orchestrator] Speaker extraction failed, continuing without speakers:', error instanceof Error ? error.message : error);
        }

        return {
          metadata,
          speakers,
          crawlStats: {
            pagesCrawled: crawlResults.length,
            totalContentLength,
            durationMs: Date.now() - extractionStart,
            provider
          }
        } satisfies ExtractionPayload;
      }, 'firecrawl');
    },
    {
      maxConcurrency: Math.min(ORCHESTRATOR_CONFIG.parallel.maxConcurrentExtractions, 3),
      enableEarlyTermination: false,
      qualityThreshold: ORCHESTRATOR_CONFIG.thresholds.parseQuality,
      minResults: 1
    }
  );

  const events: EventCandidate[] = [];

  extractionResults.forEach((result, index) => {
    const prioritizedItem = limitedPrioritized[index];
    if (!prioritizedItem) {
      return;
    }

    if (!result.success || !result.result) {
      console.warn('[optimized-orchestrator] Extraction failed for URL, applying fallback:', prioritizedItem.url);
      return;
    }

    const payload = result.result as ExtractionPayload;
    if (!payload) {
      console.warn('[optimized-orchestrator] Extraction payload empty, skipping:', prioritizedItem.url);
      return;
    }

    const mappedSpeakers = payload.speakers
      .slice(0, ORCHESTRATOR_CONFIG.limits.maxSpeakers)
      .map((speaker) => ({
        name: speaker.name,
        title: speaker.title || undefined,
        company: speaker.company || undefined
      }));

    events.push({
      url: prioritizedItem.url,
      title: payload.metadata.title || 'Untitled Event',
      description: payload.metadata.description || '',
      date: payload.metadata.date || '',
      location: payload.metadata.location || '',
      venue: '',
      speakers: mappedSpeakers,
      sponsors: [],
      confidence: prioritizedItem.score,
      source: payload.crawlStats.provider,
      metadata: {
        originalQuery: prioritizedItem.url,
        country: params.country,
        processingTime: result.duration,
        stageTimings: {
          extraction: result.duration
        },
        analysis: {
          organizer: payload.metadata.organizer,
          website: payload.metadata.website,
          registrationUrl: payload.metadata.registrationUrl,
          pagesCrawled: payload.crawlStats.pagesCrawled,
          totalContentLength: payload.crawlStats.totalContentLength
        }
      }
    });
  });

  console.log('[optimized-orchestrator] Extraction summary (before filtering):', {
    requested: prioritized.length,
    produced: events.length,
    durationMs: Date.now() - startTime
  });
  
  // Filter events by content relevance to user profile
  const filteredEvents = await filterByContentRelevance(events, params);
  
  console.log('[optimized-orchestrator] Content filtering summary:', {
    beforeFiltering: events.length,
    afterFiltering: filteredEvents.length,
    filtered: events.length - filteredEvents.length
  });
  
  return filteredEvents;
}

/**
 * Filter events by content relevance to user profile
 */
async function filterByContentRelevance(events: EventCandidate[], params: OptimizedSearchParams): Promise<EventCandidate[]> {
  if (events.length === 0) return [];
  
  const userProfile = await getUserProfile();
  if (!userProfile || !userProfile.industry_terms || userProfile.industry_terms.length === 0) {
    console.log('[optimized-orchestrator] No user profile or industry terms, skipping content filtering');
    return events;
  }
  
  const industryTerms = (userProfile.industry_terms as string[]).map(term => term.toLowerCase());
  const icpTerms = (userProfile.icp_terms as string[] || []).map(term => term.toLowerCase());
  
  console.log('[optimized-orchestrator] Filtering with industry terms:', industryTerms.slice(0, 5), 'and ICP terms:', icpTerms.slice(0, 3));
  
  // Non-event keywords that should immediately disqualify a result
  const NON_EVENT_KEYWORDS = [
    'allgemeine geschäftsbedingungen',
    'agb',
    'general terms and conditions',
    'terms of service',
    'terms and conditions',
    'privacy policy',
    'datenschutzerklärung',
    'cookie policy',
    'impressum',
    'legal notice',
    'disclaimer'
  ];
  
  return events.filter(event => {
    const searchText = `${event.title} ${event.description}`.toLowerCase();
    const titleLower = event.title.toLowerCase();
    
    // FIRST: Exclude non-event pages (legal, static pages)
    const isNonEvent = NON_EVENT_KEYWORDS.some(keyword => titleLower.includes(keyword));
    if (isNonEvent) {
      console.log(`[optimized-orchestrator] ✗ Event filtered out (non-event page): "${event.title.substring(0, 80)}"`);
      return false;
    }
    
    // Check if event content contains ANY industry term
    const hasIndustryMatch = industryTerms.some(term => {
      // Check for word boundary matches to avoid partial matches
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchText);
    });
    
    if (hasIndustryMatch) {
      console.log(`[optimized-orchestrator] ✓ Event matches industry terms: "${event.title.substring(0, 80)}"`);
      return true;
    }
    
    // Check for ICP terms as secondary filter
    const hasIcpMatch = icpTerms.some(term => {
      const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(searchText);
    });
    
    if (hasIcpMatch) {
      console.log(`[optimized-orchestrator] ✓ Event matches ICP terms: "${event.title.substring(0, 80)}"`);
      return true;
    }
    
    console.log(`[optimized-orchestrator] ✗ Event filtered out (no match): "${event.title.substring(0, 80)}"`);
    return false;
  });
}

/**
 * Enhance event speakers using parallel processing
 */
async function enhanceEventSpeakers(events: EventCandidate[]): Promise<EventCandidate[]> {
  if (events.length === 0) return [];

  console.log('[optimized-orchestrator] Skipping secondary speaker enhancement - deep crawl already provided speaker data');
  return events;
}

/**
 * Filter and rank final events
 */
function filterAndRankEvents(events: EventCandidate[]): EventCandidate[] {
  return events
    .filter(event => event.confidence >= ORCHESTRATOR_CONFIG.thresholds.confidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, ORCHESTRATOR_CONFIG.limits.maxExtractions);
}

/**
 * Get source breakdown for metadata
 */
function getSourceBreakdown(events: EventCandidate[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  events.forEach(event => {
    breakdown[event.source] = (breakdown[event.source] || 0) + 1;
  });
  return breakdown;
}