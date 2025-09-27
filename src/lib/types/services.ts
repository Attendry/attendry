/**
 * Service Layer Type Definitions for Attendry Application
 * 
 * This file contains type definitions for service layer configurations,
 * requests, and responses used by various services in the application.
 */

import { EventData, SpeakerData, SearchResultItem, RetryConfig, RetryMetrics } from './core';

/**
 * Search service configuration
 */
export interface SearchServiceConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  maxResults: number;
  timeoutMs: number;
  retryConfig: RetryConfig;
}

/**
 * Cache service configuration
 */
export interface CacheConfig {
  type: 'memory' | 'redis' | 'database';
  ttl: number;
  maxSize: number;
  cleanupInterval: number;
  keyPrefix: string;
}

/**
 * Gemini AI service request
 */
export interface GeminiRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  safetySettings?: any[];
}

/**
 * Gemini AI service response
 */
export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  safetyRatings?: any[];
}

/**
 * Gemini filtering request
 */
export interface GeminiFilterRequest {
  items: SearchResultItem[];
  dropTitleRegex: RegExp;
  banHosts: Set<string>;
  searchConfig?: any;
}

/**
 * Gemini filtering response
 */
export interface GeminiFilterResponse {
  filteredItems: SearchResultItem[];
  decisions: Array<{
    index: number;
    isEvent: boolean;
    reason: string;
  }>;
  processingTime: number;
}

/**
 * Gemini extraction request
 */
export interface GeminiExtractionRequest {
  content: string;
  prompt: string;
  context?: any;
}

/**
 * Gemini extraction response
 */
export interface GeminiExtractionResponse {
  result: any;
  confidence: number;
  processingTime: number;
}

/**
 * Firecrawl search parameters
 */
export interface FirecrawlSearchParams {
  query: string;
  country?: string;
  from?: string;
  to?: string;
  industry?: string;
  maxResults?: number;
}

/**
 * Firecrawl search result
 */
export interface FirecrawlSearchResult {
  provider: string;
  items: SearchResultItem[];
  cached: boolean;
  searchMetadata?: {
    totalResults?: number;
    searchTime?: number;
    query?: string;
  };
}

/**
 * Firecrawl extraction request
 */
export interface FirecrawlExtractionRequest {
  url: string;
  schema?: any;
  options?: {
    onlyMainContent?: boolean;
    includeHtml?: boolean;
    includeMarkdown?: boolean;
  };
}

/**
 * Firecrawl extraction response
 */
export interface FirecrawlExtractionResponse {
  success: boolean;
  data?: {
    content: string;
    markdown?: string;
    html?: string;
    metadata?: any;
  };
  error?: string;
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  batchSize: number;
  concurrency: number;
  delayMs: number;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Batch processing result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: string;
    retryCount: number;
  }>;
  totalProcessed: number;
  processingTime: number;
}

/**
 * Token budget service configuration
 */
export interface TokenBudgetConfig {
  dailyLimit: number;
  monthlyLimit: number;
  warningThreshold: number;
  resetTime: string; // HH:MM format
}

/**
 * Token budget status
 */
export interface TokenBudgetStatus {
  dailyUsed: number;
  monthlyUsed: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  isOverLimit: boolean;
  resetTime: Date;
}

/**
 * Retry service result
 */
export interface RetryResult<T> {
  data: T;
  metrics: RetryMetrics;
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  baseURL?: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  headers?: Record<string, string>;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  request: HttpRequestOptions;
}

/**
 * Service health check configuration
 */
export interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
  endpoints: string[];
}

/**
 * Service monitoring metrics
 */
export interface ServiceMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: string;
  lastSuccess?: Date;
  uptime: number;
}

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolSize: number;
  connectionTimeout: number;
  queryTimeout: number;
}

/**
 * Database query options
 */
export interface QueryOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
}

/**
 * Database query result
 */
export interface QueryResult<T = any> {
  data: T[];
  count: number;
  error?: string;
  executionTime: number;
}

/**
 * Event processing pipeline configuration
 */
export interface EventProcessingConfig {
  stages: Array<{
    name: string;
    enabled: boolean;
    timeout: number;
    retries: number;
  }>;
  parallelProcessing: boolean;
  maxConcurrency: number;
  batchSize: number;
}

/**
 * Event processing stage result
 */
export interface EventProcessingStageResult {
  stageName: string;
  success: boolean;
  processedCount: number;
  errorCount: number;
  processingTime: number;
  errors?: string[];
}

/**
 * Event processing pipeline result
 */
export interface EventProcessingResult {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  stages: EventProcessingStageResult[];
  totalProcessingTime: number;
  events: EventData[];
}

/**
 * Search result ranking configuration
 */
export interface RankingConfig {
  algorithm: 'relevance' | 'date' | 'confidence' | 'custom';
  weights: {
    relevance: number;
    date: number;
    confidence: number;
    completeness: number;
  };
  boostFactors: {
    recentEvents: number;
    highConfidence: number;
    completeData: number;
  };
}

/**
 * Search result ranking result
 */
export interface RankingResult {
  originalOrder: number[];
  rankedOrder: number[];
  scores: number[];
  factors: Array<{
    factor: string;
    weight: number;
    scores: number[];
  }>;
}

/**
 * Content extraction configuration
 */
export interface ExtractionConfig {
  extractors: Array<{
    name: string;
    enabled: boolean;
    priority: number;
    timeout: number;
  }>;
  fallbackEnabled: boolean;
  maxRetries: number;
  contentFilters: string[];
}

/**
 * Content extraction result
 */
export interface ExtractionResult {
  success: boolean;
  content: string;
  metadata: any;
  extractor: string;
  confidence: number;
  processingTime: number;
  error?: string;
}
