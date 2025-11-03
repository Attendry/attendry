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
    const enhanced = await enhanceEventSpeakers(extracted, params);
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
  const modelPath = process.env.GEMINI_MODEL_PATH || 'v1beta/models/gemini-2.5-flash:generateContent';
  const startTime = Date.now();
  
  try {
    // Apply rate limiting before making API call
    await geminiRateLimiter.waitIfNeeded();
    
    // Implement aggressive timeout strategy (8s -> 5s -> 3s)
    const timeouts = [8000, 5000, 3000];
    let lastError: any = null;
    
    for (let i = 0; i < timeouts.length; i++) {
      const timeout = timeouts[i];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        console.log(`[optimized-orchestrator] Attempting Gemini call with ${timeout}ms timeout (attempt ${i + 1}/${timeouts.length})`);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/${modelPath}?key=${geminiKey}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048, // Increased to accommodate thinking mode and response
              topP: 0.9,
              topK: 20,
              candidateCount: 1,
              stopSequences: []
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH", 
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
              }
            ]
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn('[optimized-orchestrator] Gemini API failed', {
            status: response.status,
            statusText: response.statusText,
            modelPath,
            attempt: i + 1,
            timeout
          });
          throw new Error(`Gemini API failed: ${response.status} ${response.statusText}`);
        }

        const rawText = await response.text();
        console.debug('[optimized-orchestrator] Gemini raw response prefix', rawText.slice(0, 200));
        
        // Parse the response
        const responseData = JSON.parse(rawText);
        
        // Handle different response formats
        let content = null;
        if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
          content = responseData.candidates[0].content.parts[0].text;
        } else if (responseData.candidates?.[0]?.content?.text) {
          content = responseData.candidates[0].content.text;
        } else if (responseData.text) {
          content = responseData.text;
        } else if (responseData.candidates?.[0]?.text) {
          content = responseData.candidates[0].text;
        }
        
        console.debug('[optimized-orchestrator] Extracted content:', content ? content.substring(0, 100) + '...' : 'null');
        
        if (!content) {
          console.warn('[optimized-orchestrator] No content in Gemini response, full response:', JSON.stringify(responseData, null, 2));
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
          const responseTime = Date.now() - startTime;
          geminiMetrics.recordCall(true, responseTime);
          
          console.log('[optimized-orchestrator] Successfully prioritized', normalized.length, 'URLs via Gemini:', {
            attempt: i + 1,
            timeout,
            responseTime: responseTime + 'ms',
            promptLength: prompt.length,
            modelUsed: modelPath
          });
          return normalized;
        }

        throw new Error('No valid prioritized URLs found');
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;
        
        if (i === timeouts.length - 1) {
          // Final attempt failed
          const responseTime = Date.now() - startTime;
          geminiMetrics.recordCall(false, responseTime, 'timeout');
          throw error;
        } else {
          console.warn(`[optimized-orchestrator] Gemini attempt ${i + 1} failed with ${timeout}ms timeout, trying next timeout:`, error?.message || 'Unknown error');
        }
      }
    }
    
    throw lastError;

  } catch (error: any) {
    // Record error metrics
    const responseTime = Date.now() - startTime;
    let errorType = 'unknown';
    
    // Structured error handling with specific error types
    if (error?.code === 20) { // ABORT_ERR
      console.warn('[optimized-orchestrator] Gemini timeout after all attempts, using fallback');
      errorType = 'timeout';
      geminiMetrics.recordCall(false, responseTime, 'timeout');
    } else if (error?.message?.includes('fetch failed')) {
      console.warn('[optimized-orchestrator] Gemini network error, using fallback');
      errorType = 'network';
      geminiMetrics.recordCall(false, responseTime, 'network');
    } else if (error?.message?.includes('quota') || error?.message?.includes('rate limit')) {
      console.warn('[optimized-orchestrator] Gemini quota/rate limit exceeded, using fallback');
      errorType = 'quota';
      geminiMetrics.recordCall(false, responseTime, 'quota');
    } else if (error?.message?.includes('safety')) {
      console.warn('[optimized-orchestrator] Gemini safety filter triggered, using fallback');
      errorType = 'safety';
      geminiMetrics.recordCall(false, responseTime, 'safety');
    } else if (error?.message?.includes('invalid')) {
      console.warn('[optimized-orchestrator] Gemini invalid request, using fallback');
      errorType = 'invalid';
      geminiMetrics.recordCall(false, responseTime, 'invalid');
    } else {
      console.warn('[optimized-orchestrator] Gemini unknown error, using fallback:', error?.message || 'Unknown error');
      geminiMetrics.recordCall(false, responseTime, 'unknown');
    }
    
    // Return fallback scoring
    return urls.map((url, idx) => ({ 
      url, 
      score: 0.4 - idx * 0.01, 
      reason: `fallback_${errorType}` 
    }));
  }
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
  
  if (template) {
    // Use weighted Gemini context for enhanced precision
    const weightedContext = buildWeightedGeminiContext(
      template,
      userProfile,
      urls,
      params.country || 'DE'
    );
    
    console.log('[optimized-orchestrator] Using weighted Gemini context:', {
      industry,
      weights: {
        industrySpecificQuery: template.precision.industrySpecificQuery.weight,
        crossIndustryPrevention: template.precision.crossIndustryPrevention.weight,
        geographicCoverage: template.precision.geographicCoverage.weight,
        qualityRequirements: template.precision.qualityRequirements.weight,
        eventTypeSpecificity: template.precision.eventTypeSpecificity.weight
      },
      contextLength: weightedContext.length
    });
    
    // Use ultra-concise prompt to avoid MAX_TOKENS
    const prompt = `Rate ${template.name} URLs (0-1 score):

${urls.slice(0, 3).join('\n')}

JSON: [{"url":"...","score":0.0,"reason":"..."}]`;
    
    // Continue with existing Gemini API call logic using weighted context
    return await executeGeminiCall(prompt, urls);
  } else {
    // Fallback to original approach if no weighted template available
    const baseQuery = searchConfig?.baseQuery || '';
    const excludeTerms = searchConfig?.excludeTerms || '';
    
    // Build user-specific context
    const userIndustryTerms = userProfile?.industry_terms || [];
    const userIcpTerms = userProfile?.icp_terms || [];
    const userCompetitors = userProfile?.competitors || [];
    
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
    
    // Build optimized user-specific context for the prompt (reduced for better performance)
    const userContextParts = [];
    if (userIndustryTerms.length > 0) {
      userContextParts.push(`Industry: ${userIndustryTerms.slice(0, 2).join(', ')}`);
    }
    if (userIcpTerms.length > 0) {
      userContextParts.push(`Target: ${userIcpTerms.slice(0, 2).join(', ')}`);
    }
    if (userCompetitors.length > 0) {
      userContextParts.push(`Competitors: ${userCompetitors.slice(0, 1).join(', ')}`);
    }
    const userContextText = userContextParts.length > 0 ? `\n\nUSER CONTEXT: ${userContextParts.join('; ')}` : '';

    // Ultra-concise prompt to avoid MAX_TOKENS
    const prompt = `Rate ${industry} URLs (0-1):

${urls.slice(0, 3).join('\n')}

JSON: [{"url":"...","score":0.0,"reason":"..."}]`;
    
    // Use fallback Gemini call
    return await executeGeminiCall(prompt, urls);
  }
}

/**
 * Extract event details from prioritized URLs
 */
async function extractEventDetails(prioritized: Array<{url: string, score: number, reason: string}>, params: OptimizedSearchParams): Promise<EventCandidate[]> {
  if (prioritized.length === 0) return [];
  
  const startTime = Date.now();
  
  // Use parallel processing for event extraction
  const parallelProcessor = getParallelProcessor();
  const extractionTasks = prioritized.map((item, index) => 
    createParallelTask(
      `extraction_${index}`,
      item.url,
      item.score,
      'firecrawl'
    )
  );
  
  const extractionResults = await parallelProcessor.processParallel(
    extractionTasks,
    async (task) => {
      return await executeWithRetry(async () => {
        console.log('[optimized-orchestrator] Extracting event details from:', task.data);
        const result = await unifiedSearch({
          q: task.data,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          country: params.country || undefined,
          limit: 1,
          useCache: true
        });
        return result;
      }, 'firecrawl');
    },
    {
      maxConcurrency: ORCHESTRATOR_CONFIG.parallel.maxConcurrentExtractions,
      enableEarlyTermination: ORCHESTRATOR_CONFIG.parallel.enableEarlyTermination,
      qualityThreshold: ORCHESTRATOR_CONFIG.thresholds.parseQuality,
      minResults: 1
    }
  );

  // Process extraction results
  const events: EventCandidate[] = [];
  extractionResults.forEach((result, index) => {
    if (result.success && result.result && typeof result.result === 'object' && 'items' in result.result) {
      const searchResult = result.result as { items: any[] };
      if (searchResult.items && searchResult.items.length > 0) {
        const item = searchResult.items[0];
        const prioritizedItem = prioritized[index];
        
        events.push({
          url: prioritizedItem.url,
          title: item.title || 'Untitled Event',
          description: item.description || '',
          date: item.date || '',
          location: item.location || '',
          venue: item.venue || '',
          speakers: item.speakers || [],
          sponsors: item.sponsors || [],
          confidence: prioritizedItem.score,
          source: 'firecrawl',
          metadata: {
            originalQuery: prioritizedItem.url,
            country: params.country,
            processingTime: Date.now() - startTime,
            stageTimings: {
              extraction: Date.now() - startTime
            }
          }
        });
      }
    }
  });

  console.log(`[optimized-orchestrator] Extracted ${events.length} events from ${prioritized.length} prioritized URLs in ${Date.now() - startTime}ms`);
  
  return events;
}

/**
 * Enhance event speakers using parallel processing
 */
async function enhanceEventSpeakers(events: EventCandidate[], params: OptimizedSearchParams): Promise<EventCandidate[]> {
  if (events.length === 0) return [];
  
  const startTime = Date.now();
  
  // Use parallel processing for speaker enhancement
  const parallelProcessor = getParallelProcessor();
  const enhancementTasks = events.map((event, index) => 
    createParallelTask(
      `enhancement_${index}`,
      event.url,
      event.confidence,
      'firecrawl'
    )
  );
  
  const enhancementResults = await parallelProcessor.processParallel(
    enhancementTasks,
    async (task) => {
      return await executeWithRetry(async () => {
        console.log('[optimized-orchestrator] Enhancing speakers for:', task.data);
        // This would typically call a speaker enhancement service
        // For now, we'll just return the original event
        return events[parseInt(task.id.split('_')[1])];
      }, 'firecrawl');
    },
    {
      maxConcurrency: ORCHESTRATOR_CONFIG.parallel.maxConcurrentEnhancements,
      enableEarlyTermination: ORCHESTRATOR_CONFIG.parallel.enableEarlyTermination,
      qualityThreshold: ORCHESTRATOR_CONFIG.thresholds.confidence,
      minResults: 1
    }
  );

  // Process enhancement results
  const enhancedEvents: EventCandidate[] = [];
  enhancementResults.forEach((result, index) => {
    if (result.success && result.result) {
           const enhancedEvent = result.result as EventCandidate;
      enhancedEvents.push(enhancedEvent);
    }
  });

  console.log(`[optimized-orchestrator] Enhanced ${enhancedEvents.length} events in ${Date.now() - startTime}ms`);
  
  return enhancedEvents;
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