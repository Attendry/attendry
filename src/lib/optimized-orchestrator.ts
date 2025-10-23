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

import { unifiedSearch } from './search/unified-search-core';
import { executeWithRetry, executeWithGracefulDegradation, executeWithCircuitBreaker } from './error-recovery';
import { supabaseServer } from './supabase-server';
import { getCountryContext } from './utils/country';
import { loadActiveConfig } from '../common/search/config';
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
    maxConcurrentExtractions: getOptimizedConcurrency().maxConcurrentExtractions,
    maxConcurrentEnhancements: getOptimizedConcurrency().maxConcurrentEnhancements,
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
    // Step 1: Build optimized query
    const queryBuildStart = Date.now();
    const query = await buildOptimizedQuery(params);
    const queryBuildTime = Date.now() - queryBuildStart;
    logs.push({
      stage: 'query_build',
      message: 'Built optimized search query',
      timestamp: new Date().toISOString(),
      data: { query: query.substring(0, 100) + '...', duration: queryBuildTime }
    });

    // Step 2: Multi-source discovery
    const discoveryStart = Date.now();
    const candidates = await discoverEventCandidates(query, params);
    const discoveryTime = Date.now() - discoveryStart;
    logs.push({
      stage: 'discovery',
      message: `Discovered ${candidates.length} candidates`,
      timestamp: new Date().toISOString(),
      data: { candidateCount: candidates.length, duration: discoveryTime }
    });

    // Step 3: Intelligent prioritization
    const prioritizationStart = Date.now();
    const prioritized = await prioritizeCandidates(candidates, params);
    const prioritizationTime = Date.now() - prioritizationStart;
    logs.push({
      stage: 'prioritization',
      message: `Prioritized ${prioritized.length} candidates`,
      timestamp: new Date().toISOString(),
      data: { prioritizedCount: prioritized.length, duration: prioritizationTime }
    });

    // Step 4: Parallel extraction
    const extractionStart = Date.now();
    const extracted = await extractEventDetails(prioritized, params);
    const extractionTime = Date.now() - extractionStart;
    logs.push({
      stage: 'extraction',
      message: `Extracted ${extracted.length} events`,
      timestamp: new Date().toISOString(),
      data: { extractedCount: extracted.length, duration: extractionTime }
    });

    // Step 5: Speaker enhancement
    const enhancementStart = Date.now();
    const enhanced = await enhanceEventSpeakers(extracted, params);
    const enhancementTime = Date.now() - enhancementStart;
    logs.push({
      stage: 'enhancement',
      message: `Enhanced ${enhanced.length} events`,
      timestamp: new Date().toISOString(),
      data: { enhancedCount: enhanced.length, duration: enhancementTime }
    });

    // Step 6: Final filtering and ranking
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
 * Build optimized search query using unified query builder
 */
async function buildOptimizedQuery(params: OptimizedSearchParams): Promise<string> {
  // Use unified query builder for enhanced query generation
  const { buildUnifiedQuery } = await import('@/lib/unified-query-builder');
  
  const result = await buildUnifiedQuery({
    userText: params.userText,
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

/**
 * Discover event candidates from multiple sources using parallel processing
 */
async function discoverEventCandidates(query: string, params: OptimizedSearchParams): Promise<string[]> {
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
        return await unifiedSearch({
          q: task.data,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          country: params.country || undefined,
          limit: Math.ceil(ORCHESTRATOR_CONFIG.limits.maxCandidates / queryVariations.length),
          useCache: true
        });
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
    console.warn('[optimized-orchestrator] Prioritization failed, using fallback scoring:', error);
    return urls.map(url => ({ url, score: 0.5, reason: 'fallback' }));
  }
}

/**
 * Prioritize URLs using Gemini 2.5-flash with Enhanced Orchestrator approach
 * This replaces the broken batching system with the proven single-call approach
 */
async function prioritizeWithGemini(urls: string[], params: OptimizedSearchParams): Promise<Array<{url: string, score: number, reason: string}>> {
  if (!geminiKey) {
    console.warn('[optimized-orchestrator] No GEMINI_API_KEY, returning fallback scoring');
    return urls.map((url, idx) => ({ url, score: 0.4 - idx * 0.01, reason: 'api_key_missing' }));
  }

  // Get search configuration for context
  const searchConfig = await getSearchConfig();
  const industry = searchConfig?.industry || 'general';
  const baseQuery = searchConfig?.baseQuery || '';
  const excludeTerms = searchConfig?.excludeTerms || '';
  
  // Build location context
  const countryContext = getCountryContext(params.country);
  const locationContext = countryContext.countryNames[0] || 'Europe';
  
  // Build timeframe context
  let timeframeLabel = 'within the specified timeframe';
  if (params.dateFrom && params.dateTo) {
    const fromDate = new Date(params.dateFrom);
    const toDate = new Date(params.dateTo);
    const now = new Date();
    
    if (fromDate >= now) {
      const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      timeframeLabel = `within the next ${daysDiff} days`;
    } else if (toDate <= now) {
      const daysDiff = Math.ceil((fromDate.getTime() - toDate.getTime()) / (1000 * 60 * 60 * 24));
      timeframeLabel = `within the past ${daysDiff} days`;
    } else {
      timeframeLabel = `from ${params.dateFrom} to ${params.dateTo}`;
    }
  }
  
  // Use the proven Enhanced Orchestrator prompt approach
  const prompt = `You are an expert in ${industry} events and conferences. 

SEARCH CONTEXT:
- Industry: ${industry}
- Base Query: ${baseQuery}
- Exclude Terms: ${excludeTerms}
- Location: ${locationContext}
- Timeframe: ${timeframeLabel}

TASK: From the URLs below, return the top 10 most relevant for ${industry} events that are:
1. Actually taking place ${locationContext} (events mentioning ${locationContext} or taking place there)
2. ${timeframeLabel}
3. Match the search context: ${baseQuery}
4. Are real events (conferences, workshops, seminars, exhibitions, trade shows, etc.) - not general websites, documentation, or non-event pages
5. Exclude events that are clearly from other countries unless they're international events relevant to ${locationContext}

IMPORTANT FILTERING RULES:
- STRICTLY prioritize events that are physically located ${locationContext}
- ONLY include international events if they explicitly mention ${locationContext} or are clearly relevant to ${locationContext} professionals
- EXCLUDE events that are clearly from other countries (US, UK, etc.) unless they explicitly mention ${locationContext}
- Focus on actual event pages, not documentation, news, or general information pages
- Look for event-specific indicators: dates, venues, registration, speakers, agenda
- For Germany search: prioritize events in German cities, German venues, or events explicitly mentioning Germany

URLs: ${urls.slice(0, 20).join('\n')}

Return a JSON array of objects, each with:
{
  "url": "https://...",
  "score": number between 0 and 1 (higher = more relevant),
  "reason": "short explanation"
}

Include at most 10 items. Only include URLs you see in the list.`;

  const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';
  
  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(`https://generativelanguage.googleapis.com/${modelPath}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[optimized-orchestrator] Gemini API failed', {
        status: response.status,
        statusText: response.statusText,
        modelPath,
      });
      throw new Error(`Gemini API failed: ${response.status} ${response.statusText}`);
    }

    const rawText = await response.text();
    console.debug('[optimized-orchestrator] Gemini raw response prefix', rawText.slice(0, 80));
    
    // Parse the response
    const responseData = JSON.parse(rawText);
    const content = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.warn('[optimized-orchestrator] No content in Gemini response');
      throw new Error('No content in Gemini response');
    }

    // Extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[optimized-orchestrator] No JSON array found in response');
      throw new Error('No JSON array found in response');
    }

    const prioritized = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(prioritized)) {
      throw new Error('Response is not an array');
    }

    // Normalize and validate results
    const normalized = prioritized
      .map((item: any, idx: number) => {
        if (typeof item === 'string') {
          return { url: item, score: 0.5 - idx * 0.02, reason: 'string_result' };
        }
        if (!item || typeof item.url !== 'string') return null;
        const score = typeof item.score === 'number' ? item.score : 0.5 - idx * 0.02;
        return {
          url: item.url,
          score: Math.min(Math.max(score, 0), 1),
          reason: typeof item.reason === 'string' ? item.reason : 'gemini'
        };
      })
      .filter((item: any): item is {url: string, score: number, reason: string} => !!item)
      .filter(item => urls.includes(item.url));

    if (normalized.length > 0) {
      console.log('[optimized-orchestrator] Successfully prioritized', normalized.length, 'URLs via Gemini');
      return normalized;
    }

    throw new Error('No valid prioritized URLs found');

  } catch (error) {
    console.warn('[optimized-orchestrator] Gemini prioritization failed, using fallback:', error);
    
    // Enhanced fallback scoring based on URL patterns (from Enhanced Orchestrator)
    const prioritized = urls
      .map((url, idx) => {
        const urlLower = url.toLowerCase();
        let score = 0.2 - idx * 0.01;
        if (urlLower.includes('.de')) score += 0.4;
        if (urlLower.includes('germany') || urlLower.includes('deutschland')) score += 0.3;
        if (urlLower.includes('event') || urlLower.includes('conference') || urlLower.includes('summit')) score += 0.2;
        return { url, score: Math.min(Math.max(score, 0), 1), reason: 'fallback_heuristic' };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    return prioritized;
  }
}

/**
 * Extract event details in parallel using Smart Parallel Processor
 */
async function extractEventDetails(prioritized: Array<{url: string, score: number, reason: string}>, params: OptimizedSearchParams): Promise<EventCandidate[]> {
  if (prioritized.length === 0) return [];
  
  const startTime = Date.now();
  
  // Create parallel tasks with priority based on score
  const tasks = prioritized.map((item, index) => 
    createParallelTask(
      `extraction_${index}`,
      item.url,
      item.score, // Use score as priority
      'firecrawl',
      { timeout: ORCHESTRATOR_CONFIG.timeouts.extraction }
    )
  );
  
  // Use smart parallel processor
  const parallelProcessor = getParallelProcessor();
  const results = await parallelProcessor.processParallel(
    tasks,
    async (task) => {
      return await extractSingleEvent(task.data, params);
    },
    {
      maxConcurrency: ORCHESTRATOR_CONFIG.parallel.maxConcurrentExtractions,
      enableEarlyTermination: ORCHESTRATOR_CONFIG.parallel.enableEarlyTermination,
      qualityThreshold: 0.8,
      minResults: 5
    }
  );
  
  // Filter successful results
  const successfulResults = results
    .filter(result => result.success && result.result)
    .map(result => result.result as EventCandidate);
  
  console.log(`[optimized-orchestrator] Extracted ${successfulResults.length}/${prioritized.length} events in ${Date.now() - startTime}ms`);
  
  // Log parallel processing metrics
  const metrics = parallelProcessor.getMetrics();
  console.log(`[optimized-orchestrator] Parallel processing metrics:`, {
    throughput: metrics.throughput.toFixed(2),
    concurrencyLevel: metrics.concurrencyLevel,
    averageDuration: metrics.averageDuration.toFixed(0),
    resourceUtilization: metrics.resourceUtilization
  });
  
  return successfulResults;
}

/**
 * Extract details for a single event
 */
async function extractSingleEvent(url: string, params: OptimizedSearchParams): Promise<EventCandidate> {
  const startTime = Date.now();
  
  // Use Firecrawl for content extraction
  const content = await extractWithFirecrawl(url);
  
  // Parse event details from content
  const eventDetails = await parseEventDetails(content, url);
  
  return {
    url,
    title: eventDetails.title,
    description: eventDetails.description,
    date: eventDetails.date,
    location: eventDetails.location,
    venue: eventDetails.venue,
    speakers: eventDetails.speakers,
    sponsors: eventDetails.sponsors,
    confidence: eventDetails.confidence,
    source: 'firecrawl',
    metadata: {
      originalQuery: params.userText || '',
      country: params.country,
      processingTime: Date.now() - startTime,
      stageTimings: {
        extraction: Date.now() - startTime
      }
    }
  };
}

/**
 * Extract content using Firecrawl with deep crawling for speaker pages
 */
async function extractWithFirecrawl(url: string): Promise<string> {
  if (!firecrawlKey) {
    throw new Error('Firecrawl API key not available');
  }

  try {
    // First, scrape the main page to get content and discover sub-pages
    const mainResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: false, // Get full content to find sub-pages
        timeout: ORCHESTRATOR_CONFIG.timeouts.extraction
      }),
      signal: AbortSignal.timeout(ORCHESTRATOR_CONFIG.timeouts.extraction + 5000) // Add 5s buffer
    });

    if (!mainResponse.ok) {
      throw new Error(`Firecrawl error: ${mainResponse.status}`);
    }

    const mainData = await mainResponse.json();
    let combinedContent = mainData.data?.markdown || '';
    
    // Discover speaker-related sub-pages
    const subPageUrls = extractSpeakerSubPages(url, combinedContent);
    console.log(`[optimized-orchestrator] Found ${subPageUrls.length} speaker sub-pages for ${url}`);
    
    // Crawl up to 3 most relevant speaker sub-pages
    const relevantSubPages = subPageUrls.slice(0, 3);
    const subPageContents: string[] = [];
    
    for (const subPageUrl of relevantSubPages) {
      try {
        console.log(`[optimized-orchestrator] Crawling speaker sub-page: ${subPageUrl}`);
        const subResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: subPageUrl,
            formats: ['markdown'],
            onlyMainContent: true,
            timeout: ORCHESTRATOR_CONFIG.timeouts.extraction
          }),
          signal: AbortSignal.timeout(ORCHESTRATOR_CONFIG.timeouts.extraction)
        });

        if (subResponse.ok) {
          const subData = await subResponse.json();
          const subContent = subData.data?.markdown || '';
          if (subContent.length > 100) { // Only include substantial content
            subPageContents.push(subContent);
            console.log(`[optimized-orchestrator] Successfully crawled sub-page: ${subPageUrl} (${subContent.length} chars)`);
          }
        } else {
          console.warn(`[optimized-orchestrator] Failed to crawl sub-page ${subPageUrl}: ${subResponse.status}`);
        }
      } catch (error) {
        console.warn(`[optimized-orchestrator] Error crawling sub-page ${subPageUrl}:`, error);
      }
    }
    
    // Combine main page content with sub-page content
    if (subPageContents.length > 0) {
      combinedContent += '\n\n--- SPEAKER PAGES ---\n\n' + subPageContents.join('\n\n---\n\n');
      console.log(`[optimized-orchestrator] Combined content: ${combinedContent.length} chars (main: ${mainData.data?.markdown?.length || 0}, sub-pages: ${subPageContents.length})`);
    }
    
    return combinedContent;
    
  } catch (error) {
    console.error(`[optimized-orchestrator] Firecrawl extraction failed for ${url}:`, error);
    throw error;
  }
}

/**
 * Extract speaker-related sub-page URLs from content
 */
function extractSpeakerSubPages(baseUrl: string, content: string): string[] {
  const urls: Array<{ url: string; priority: 'high' | 'medium' | 'low' }> = [];
  const baseDomain = new URL(baseUrl).origin;
  
  // High-priority speaker page keywords (English and German)
  const highPriorityKeywords = [
    // English terms - actual speaker pages
    'speaker', 'speakers', 'presenter', 'presenters', 'faculty',
    // German terms - actual speaker pages
    'referenten', 'referentin', 'sprecher', 'sprecherin'
  ];
  
  // Medium-priority agenda/program keywords
  const mediumPriorityKeywords = [
    // English terms
    'agenda', 'program', 'programme', 'schedule',
    // German terms
    'programm', 'agenda', 'zeitplan'
  ];
  
  // Low-priority keywords (avoid unless no better options)
  const lowPriorityKeywords = [
    'team', 'organizer', 'organiser', 'about', 'participants', 'attendees',
    'teilnehmer', 'teilnehmerin', 'moderatoren', 'moderatorin', 'organisatoren',
    'veranstalter', 'über'
  ];
  
  // Enhanced regex patterns to find URLs
  const urlPatterns = [
    /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,  // Absolute URLs
    /href=["']([^"']+)["']/g,            // href attributes
    /src=["']([^"']+)["']/g              // src attributes
  ];
  
  for (const pattern of urlPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let urlString = match[1] || match[0];
      
      // Handle relative URLs
      if (urlString.startsWith('/')) {
        urlString = baseDomain + urlString;
      } else if (!urlString.startsWith('http')) {
        continue; // Skip non-URL matches
      }
      
      try {
        const url = new URL(urlString);
        // Only include URLs from the same domain
        if (url.origin === baseDomain) {
          const urlLower = url.pathname.toLowerCase();
          
          // Prioritize high-priority speaker pages
          if (highPriorityKeywords.some(keyword => urlLower.includes(keyword))) {
            urls.push({ url: urlString, priority: 'high' as const });
          }
          // Include medium-priority agenda pages
          else if (mediumPriorityKeywords.some(keyword => urlLower.includes(keyword))) {
            urls.push({ url: urlString, priority: 'medium' as const });
          }
          // Only include low-priority pages if we don't have enough high/medium priority ones
          else if (lowPriorityKeywords.some(keyword => urlLower.includes(keyword))) {
            urls.push({ url: urlString, priority: 'low' as const });
          }
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }
  
  // Also add common speaker page patterns if not found
  const commonSpeakerPaths: Array<{ path: string; priority: 'high' | 'medium' | 'low' }> = [
    { path: '/referenten/', priority: 'high' },
    { path: '/speakers/', priority: 'high' },
    { path: '/presenters/', priority: 'high' },
    { path: '/faculty/', priority: 'high' },
    { path: '/agenda/', priority: 'medium' },
    { path: '/programm/', priority: 'medium' },
    { path: '/program/', priority: 'medium' }
  ];
  
  for (const { path, priority } of commonSpeakerPaths) {
    const fullUrl = baseDomain + path;
    if (!urls.some(u => u.url === fullUrl)) {
      urls.push({ url: fullUrl, priority });
    }
  }
  
  // Sort by priority and return top URLs
  const sortedUrls = urls
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    })
    .slice(0, 5) // Limit to top 5 most relevant pages
    .map(item => item.url);
  
  return [...new Set(sortedUrls)]; // Remove duplicates
}

/**
 * Parse event details from content
 */
async function parseEventDetails(content: string, url: string): Promise<{
  title?: string;
  description?: string;
  date?: string;
  location?: string;
  venue?: string;
  speakers: SpeakerInfo[];
  sponsors: SponsorInfo[];
  confidence: number;
}> {
  // Enhanced parsing logic to avoid navigation elements
  const lines = content.split('\n').filter(line => line.trim());
  
  let title = '';
  let description = '';
  let date = '';
  let location = '';
  let venue = '';
  const speakers: SpeakerInfo[] = [];
  const sponsors: SponsorInfo[] = [];
  
  // Filter out navigation and common non-content elements
  const navigationTerms = [
    'navigation', 'nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb',
    'skip to', 'go to', 'jump to', 'back to', 'return to', 'home', 'about',
    'contact', 'privacy', 'terms', 'cookie', 'sitemap', 'search', 'login',
    'register', 'sign up', 'sign in', 'logout', 'profile', 'account', 'settings',
    'help', 'support', 'faq', 'newsletter', 'subscribe', 'follow us', 'social media',
    'twitter', 'facebook', 'linkedin', 'instagram', 'youtube', 'rss', 'feed',
    'copyright', 'all rights reserved', 'powered by', 'built with', 'designed by'
  ];
  
  const filteredLines = lines.filter(line => {
    const lineLower = line.toLowerCase();
    return !navigationTerms.some(term => lineLower.includes(term)) &&
           line.length > 10 && // Avoid very short lines
           line.length < 200 && // Avoid very long lines
           !line.match(/^[\[\](){}|\\^`~!@#$%&*+=<>?/]+$/) && // Avoid pure symbols
           !line.match(/^https?:\/\//) && // Avoid pure URLs
           !line.match(/^[A-Z\s]+$/) && // Avoid pure uppercase (often navigation)
           !line.match(/^\d+$/) && // Avoid pure numbers
           !line.match(/^[a-z\s]+$/) && // Avoid pure lowercase (often navigation)
           !line.includes('To Navigation') && // Specific navigation elements
           !line.includes('To Search') &&
           !line.includes('To Main') &&
           !line.includes('Go To');
  });
  
  // Extract title (first meaningful line from filtered content)
  if (filteredLines.length > 0) {
    title = filteredLines[0].trim();
  } else if (lines.length > 0) {
    // Fallback to original lines if filtering removed everything
    title = lines[0].trim();
  }
  
  // Extract description (look for longer text blocks)
  const descriptionLines = lines.filter(line => line.length > 50);
  if (descriptionLines.length > 0) {
    description = descriptionLines[0].trim();
  }
  
  // Extract date (look for date patterns)
  const dateMatch = content.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);
  if (dateMatch) {
    date = dateMatch[1];
  }
  
  // Extract location (look for city, country patterns)
  const locationMatch = content.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+)/);
  if (locationMatch) {
    location = `${locationMatch[1]}, ${locationMatch[2]}`;
  }
  
  // Extract speakers with enhanced patterns (more selective)
  const speakerPatterns = [
    // Pattern 1: "Name, Title, Company" (more flexible)
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s*,\s*([^,\n]+?))(?:\s*,\s*([^,\n]+?))?(?:\s*[,;]|$)/g,
    // Pattern 2: "Name - Title at Company"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[-–]\s*([^,\n]+?)(?:\s+at\s+([^,\n]+?))?(?:\s*[,;]|$)/g,
    // Pattern 3: "Name (Title, Company)"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\(([^,\n]+?)(?:,\s*([^,\n]+?))?\)/g,
    // Pattern 4: "Name | Title | Company"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\|\s*([^,\n]+?)(?:\s*\|\s*([^,\n]+?))?(?:\s*[,;]|$)/g,
    // Pattern 5: German patterns "Referent:", "Sprecher:", "Moderator:"
    /(?:Referent|Sprecher|Moderator|Speaker|Presenter):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s*,\s*([^,\n]+?))?(?:\s*,\s*([^,\n]+?))?(?:\s*[,;]|$)/gi,
    // Pattern 6: Keynote speaker patterns
    /(?:Keynote|Opening|Closing)\s+(?:Speaker|Presenter):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s*,\s*([^,\n]+?))?(?:\s*[,;]|$)/gi
  ];

  const seenSpeakers = new Set<string>();
  
  // Get industry-specific non-speaker terms from user profile and search config
  const userProfile = await getUserProfile();
  const searchConfig = await getSearchConfig();
  
  const industryTerms = searchConfig?.industry_terms || [];
  const userIndustryTerms = userProfile?.industry_terms || [];
  const allIndustryTerms = [...new Set([...industryTerms, ...userIndustryTerms])];
  
  // Common non-speaker terms that apply to all industries
  const commonNonSpeakerTerms = [
    'agenda', 'program', 'schedule', 'session', 'workshop', 'seminar', 'conference',
    'event', 'meeting', 'summit', 'forum', 'exhibition', 'trade show', 'management',
    'strategy', 'business', 'digital', 'transformation', 'innovation', 'technology'
  ];
  
  // Combine industry terms with common non-speaker terms
  const nonSpeakerTerms = [...new Set([...allIndustryTerms, ...commonNonSpeakerTerms])];
  
  // Use filtered content for speaker extraction to avoid navigation elements
  const filteredContent = filteredLines.join('\n');
  
  for (const pattern of speakerPatterns) {
    const matches = filteredContent.match(pattern);
    if (matches) {
      matches.slice(0, ORCHESTRATOR_CONFIG.limits.maxSpeakers).forEach(match => {
        const parts = match.split(/[,;|()]/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 1) {
          const name = parts[0].trim();
          const title = parts[1]?.trim() || undefined;
          const company = parts[2]?.trim() || undefined;
          
          // Skip if we've already seen this speaker
          const speakerKey = name.toLowerCase();
          if (seenSpeakers.has(speakerKey)) return;
          seenSpeakers.add(speakerKey);
          
          
          const nameLower = name.toLowerCase();
          const titleLower = title?.toLowerCase() || '';
          
          // Skip if name or title contains non-speaker terms
          if (nonSpeakerTerms.some(term => nameLower.includes(term) || titleLower.includes(term))) {
            return;
          }
          
          // Only add if it looks like a real name (at least 2 words) and not too long
          if (name.split(' ').length >= 2 && name.length < 50) {
            speakers.push({
              name,
              title: title && title.length > 2 ? title : "Professional",
              company: company && company.length > 2 ? company : "Various"
            });
          }
        }
      });
    }
  }
  
  // If no speakers found with patterns, try basic name extraction (with filtering)
  if (speakers.length === 0) {
    const basicNamePattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)/g;
    const nameMatches = filteredContent.match(basicNamePattern);
    if (nameMatches) {
      nameMatches.slice(0, 10).forEach(name => {
        const speakerKey = name.toLowerCase();
        const nameLower = name.toLowerCase();
        
        // Skip if it's a common non-speaker term
        if (nonSpeakerTerms.some(term => nameLower.includes(term))) {
          return;
        }
        
        if (!seenSpeakers.has(speakerKey) && name.length < 50) {
          seenSpeakers.add(speakerKey);
          speakers.push({
            name: name.trim(),
            title: "Professional",
            company: "Various"
          });
        }
      });
    }
  }
  
  // Calculate confidence based on extracted information
  let confidence = 0.3; // Base confidence
  if (title) confidence += 0.2;
  if (description) confidence += 0.2;
  if (date) confidence += 0.1;
  if (location) confidence += 0.1;
  if (speakers.length > 0) confidence += 0.1;
  
  return {
    title: title || undefined,
    description: description || undefined,
    date: date || undefined,
    location: location || undefined,
    venue: venue || undefined,
    speakers,
    sponsors,
    confidence: Math.min(confidence, 1.0)
  };
}

/**
 * Enhance event speakers using Smart Parallel Processor
 */
async function enhanceEventSpeakers(events: EventCandidate[], params: OptimizedSearchParams): Promise<EventCandidate[]> {
  if (events.length === 0) return [];
  
  const startTime = Date.now();
  
  // Create parallel tasks with priority based on confidence
  const tasks = events.map((event, index) => 
    createParallelTask(
      `enhancement_${index}`,
      event,
      event.confidence, // Use confidence as priority
      'gemini',
      { timeout: ORCHESTRATOR_CONFIG.timeouts.enhancement }
    )
  );
  
  // Use smart parallel processor
  const parallelProcessor = getParallelProcessor();
  const results = await parallelProcessor.processParallel(
    tasks,
    async (task) => {
      return await enhanceSingleEventSpeakers(task.data, params);
    },
    {
      maxConcurrency: ORCHESTRATOR_CONFIG.parallel.maxConcurrentEnhancements,
      enableEarlyTermination: false, // Don't terminate early for enhancements
      qualityThreshold: 0.9,
      minResults: 1
    }
  );
  
  // Filter successful results, fallback to original event if enhancement failed
  const enhancedResults = results.map((result, index) => {
    if (result.success && result.result) {
      return result.result as EventCandidate;
    } else {
      console.warn(`[optimized-orchestrator] Enhancement failed for ${events[index].url}, using original event`);
      return events[index]; // Return original event if enhancement fails
    }
  });
  
  console.log(`[optimized-orchestrator] Enhanced ${enhancedResults.length} events in ${Date.now() - startTime}ms`);
  
  // Log parallel processing metrics
  const metrics = parallelProcessor.getMetrics();
  console.log(`[optimized-orchestrator] Enhancement parallel processing metrics:`, {
    throughput: metrics.throughput.toFixed(2),
    concurrencyLevel: metrics.concurrencyLevel,
    averageDuration: metrics.averageDuration.toFixed(0),
    resourceUtilization: metrics.resourceUtilization
  });
  
  return enhancedResults;
}

/**
 * Enhance speakers for a single event
 */
async function enhanceSingleEventSpeakers(event: EventCandidate, params: OptimizedSearchParams): Promise<EventCandidate> {
  if (!event.speakers || event.speakers.length === 0) {
    return event;
  }
  
  const startTime = Date.now();
  
  // Use Gemini to enhance speaker information
  const enhancedSpeakers = await enhanceSpeakersWithGemini(event.speakers, event.title || '');
  
  return {
    ...event,
    speakers: enhancedSpeakers,
    confidence: Math.min(event.confidence + 0.1, 1.0), // Boost confidence for enhanced events
    metadata: {
      ...event.metadata,
      processingTime: event.metadata.processingTime + (Date.now() - startTime),
      stageTimings: {
        ...event.metadata.stageTimings,
        enhancement: Date.now() - startTime
      }
    }
  };
}

/**
 * Enhance speakers using Gemini with new prompt system
 */
async function enhanceSpeakersWithGemini(speakers: SpeakerInfo[], eventTitle: string): Promise<SpeakerInfo[]> {
  if (!geminiKey || speakers.length === 0) {
    return speakers;
  }

  // If speakers already have titles and companies, return them as-is
  const hasCompleteInfo = speakers.every(s => s.title && s.company);
  if (hasCompleteInfo) {
    return speakers;
  }

  try {
    // Get user profile for speaker enhancement context
    const userProfile = await getUserProfile();
    const userIndustryTerms = userProfile?.industry_terms || [];
    const userIcpTerms = userProfile?.icp_terms || [];
    
    // Use new prompt system with user-specific terms
    const { createSpeakerEnhancementPrompt } = await import('./prompts/gemini-prompts');
    const { promptExecutor } = await import('./prompts/prompt-executor');
    
    const prompt = createSpeakerEnhancementPrompt(speakers, 'general', userIndustryTerms, userIcpTerms);
    
    const result = await promptExecutor.executePrompt(
      prompt.content,
      prompt.config,
      speakers // Fallback data
    );
    
    if (result.success && result.data && Array.isArray(result.data)) {
      // Merge enhanced data with original speakers
      return speakers.map(originalSpeaker => {
        const enhanced = result.data!.find((e: any) => 
          e.name && originalSpeaker.name && 
          e.name.toLowerCase().includes(originalSpeaker.name.toLowerCase())
        );
        
        if (enhanced) {
          return {
            name: enhanced.name || originalSpeaker.name,
            title: enhanced.title || originalSpeaker.title || "Professional",
            company: enhanced.company || originalSpeaker.company || "Various"
          };
        }
        
        // If no enhancement found, provide fallback values
        return {
          name: originalSpeaker.name,
          title: originalSpeaker.title || "Professional",
          company: originalSpeaker.company || "Various"
        };
      });
    }
    
    // Return speakers with fallback values if enhancement fails
    return speakers.map(speaker => ({
      name: speaker.name,
      title: speaker.title || "Professional",
      company: speaker.company || "Various"
    }));
    
  } catch (error) {
    console.warn('[optimized-orchestrator] Gemini enhancement failed:', error);
    // Return speakers with fallback values if enhancement fails
    return speakers.map(speaker => ({
      name: speaker.name,
      title: speaker.title || "Professional",
      company: speaker.company || "Various"
    }));
  }
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
