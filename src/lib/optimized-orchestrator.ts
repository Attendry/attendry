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
  'vendelux.com'
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
    maxExtractions: 20,     // Increased from 15 for more results
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
    const candidates = await discoverEventCandidates(query, params, userProfile);
    const discoveryTime = Date.now() - discoveryStart;
    logs.push({
      stage: 'discovery',
      message: `Discovered ${candidates.length} candidates`,
      timestamp: new Date().toISOString(),
      data: { candidateCount: candidates.length, duration: discoveryTime }
    });

    // Step 4: Intelligent prioritization
    const prioritizationStart = Date.now();
    const prioritized = await prioritizeCandidates(candidates, params);
    const prioritizationTime = Date.now() - prioritizationStart;
    logs.push({
      stage: 'prioritization',
      message: `Prioritized ${prioritized.length} candidates`,
      timestamp: new Date().toISOString(),
      data: { prioritizedCount: prioritized.length, duration: prioritizationTime }
    });

    // Step 5: Parallel extraction
    const extractionStart = Date.now();
    const extracted = await extractEventDetails(prioritized, params);
    const extractionTime = Date.now() - extractionStart;
    logs.push({
      stage: 'extraction',
      message: `Extracted ${extracted.length} events`,
      timestamp: new Date().toISOString(),
      data: { extractedCount: extracted.length, duration: extractionTime }
    });

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

    // Record final search performance
    recordApiPerformance('optimized_search_complete', totalDuration, true, {
      eventsFound: finalEvents.length.toString(),
      averageConfidence: averageConfidence.toFixed(2),
      country: params.country || 'unknown'
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
        totalCandidates: candidates.length,
        prioritizedCandidates: prioritized.length,
        extractedCandidates: extracted.length,
        enhancedCandidates: enhanced.length,
        totalDuration,
        averageConfidence,
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
      maxConcurrency: 4, // Process all query variations in parallel
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
  
  try {
    const prioritized = await executeWithRetry(async () => {
      return await prioritizeWithGemini(urls, params);
    }, 'gemini');

    const filtered = prioritized.filter(item => item.score >= ORCHESTRATOR_CONFIG.thresholds.prioritization);
    
    console.log(`[optimized-orchestrator] Prioritized ${filtered.length}/${urls.length} candidates in ${Date.now() - startTime}ms`);
    
    return filtered;
  } catch (error) {
    console.warn('[optimized-orchestrator] Prioritization failed, using enhanced fallback scoring:', error);
    
    // Enhanced fallback scoring with URL pattern recognition
    return urls.map((url, idx) => {
      let score = 0.4 - idx * 0.02; // Base score with slight degradation
      
      // Boost scores for high-quality domains
      if (url.includes('conference') || url.includes('summit') || url.includes('event')) {
        score += 0.2;
      }
      if (url.includes('legal') || url.includes('compliance') || url.includes('regulatory')) {
        score += 0.3;
      }
      if (url.includes('de') || url.includes('germany')) {
        score += 0.1;
      }
      
      return { 
        url, 
        score: Math.min(score, 0.9), 
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
    const systemInstruction = 'Return only JSON array [{"url":"","score":0,"reason":""}]. Score 0-1. Reason<=10 chars. No explanations.';

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
          maxOutputTokens: 512,  // Increased from 48 to accommodate thinking tokens (47+) and JSON response
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

  const chunkSize = 1;
  const baseContext = `${weightedContext}${timeframeLabel}${userContextText} Score each URL 0-1. Return JSON [{"url":"","score":0,"reason":""}] (reason<=10 chars, no prose).`;

  const resultsMap = new Map<string, { url: string; score: number; reason: string }>();

  const fallbackForUrl = (url: string, idx: number, reason = 'fallback') => {
    let score = 0.4 - idx * 0.02;
    if (url.includes('conference') || url.includes('summit') || url.includes('event')) {
      score += 0.2;
    }
    if (url.includes('legal') || url.includes('compliance') || url.includes('regulatory')) {
      score += 0.25;
    }
    if (url.includes('de') || url.includes('germany')) {
      score += 0.05;
    }
    return { url, score: Math.max(0.45, Math.min(score, 0.9)), reason };
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
  
  // Use parallel processing for event extraction, but throttle to respect Firecrawl limits
  const parallelProcessor = getParallelProcessor();
  const extractionTasks = prioritized.map((item, index) =>
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

        const crawlResults = await deepCrawlEvent(url);

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
    const prioritizedItem = prioritized[index];
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

  console.log('[optimized-orchestrator] Extraction summary:', {
    requested: prioritized.length,
    produced: events.length,
    durationMs: Date.now() - startTime
  });
  
  return events;
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