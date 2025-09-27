/**
 * API-Specific Type Definitions for Attendry Application
 * 
 * This file contains type definitions specifically for API requests
 * and responses, including validation and error handling.
 */

import { EventData, SpeakerData, UserProfile, WatchlistItem, HealthStatus, ServiceHealth } from './core';

/**
 * Event search request parameters
 */
export interface EventSearchRequest {
  q?: string;
  country?: string;
  from: string;
  to: string;
  provider?: 'cse' | 'firecrawl' | 'enhanced';
  num?: number;
  rerank?: boolean;
  topK?: number;
}

/**
 * Event search response
 */
export interface EventSearchResponse {
  provider: string;
  items: EventData[];
  cached?: boolean;
  searchMetadata?: {
    totalResults?: number;
    searchTime?: number;
    query?: string;
  };
}

/**
 * Event extraction request
 */
export interface EventExtractionRequest {
  urls: string[];
  locale?: string;
  crawl?: boolean;
}

/**
 * Event extraction response
 */
export interface EventExtractionResponse {
  version: string;
  events: EventData[];
  trace?: any[];
  note?: string;
}

/**
 * Speaker extraction request
 */
export interface SpeakerExtractionRequest {
  url: string;
  includePast?: boolean;
}

/**
 * Speaker extraction response
 */
export interface SpeakerExtractionResponse {
  speakers: SpeakerData[];
  followed?: string[];
  sources?: string[];
  processingTime?: number;
}

/**
 * Event discovery pipeline request
 */
export interface EventDiscoveryRequest {
  q?: string;
  country?: string;
  from: string;
  to: string;
  provider?: string;
}

/**
 * Event discovery pipeline response
 */
export interface EventDiscoveryResponse {
  events: EventData[];
  search?: any;
  prioritization?: any;
  extract?: any;
  deduped?: any;
  enhancement?: any;
  count: number;
  saved: string[];
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  services: {
    google_cse: ServiceHealth;
    firecrawl: ServiceHealth;
    firecrawl_search: ServiceHealth;
    gemini: ServiceHealth;
    batch_gemini: ServiceHealth;
    token_budget: ServiceHealth;
    database: ServiceHealth;
    retry_service: ServiceHealth;
  };
  metrics: {
    retry_attempts: number;
    retry_failures: number;
    cache_hits: number;
    cache_misses: number;
  };
  response_time_ms?: number;
}

/**
 * Profile get response
 */
export interface ProfileGetResponse {
  profile: UserProfile | null;
}

/**
 * Profile save request
 */
export interface ProfileSaveRequest {
  full_name?: string;
  company?: string;
  competitors?: string[];
  icp_terms?: string[];
  industry_terms?: string[];
  use_in_basic_search?: boolean;
}

/**
 * Profile save response
 */
export interface ProfileSaveResponse {
  success: boolean;
  profile?: UserProfile;
}

/**
 * Watchlist add request
 */
export interface WatchlistAddRequest {
  kind: 'event' | 'speaker' | 'organization';
  label?: string;
  ref_id: string;
}

/**
 * Watchlist add response
 */
export interface WatchlistAddResponse {
  success: boolean;
  id?: string;
}

/**
 * Watchlist list response
 */
export interface WatchlistListResponse {
  items: WatchlistItem[];
  total: number;
}

/**
 * Watchlist remove request
 */
export interface WatchlistRemoveRequest {
  kind: 'event' | 'speaker' | 'organization';
  ref_id: string;
}

/**
 * Watchlist remove response
 */
export interface WatchlistRemoveResponse {
  success: boolean;
}

/**
 * Configuration get response
 */
export interface ConfigGetResponse {
  config: {
    id?: string;
    name: string;
    industry: string;
    baseQuery: string;
    excludeTerms: string;
    industryTerms: string[];
    icpTerms: string[];
    is_active?: boolean;
  };
  templates?: any;
}

/**
 * Configuration save request
 */
export interface ConfigSaveRequest {
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
  is_active?: boolean;
}

/**
 * Configuration save response
 */
export interface ConfigSaveResponse {
  success: boolean;
  id?: string;
}

/**
 * Cron job request
 */
export interface CronJobRequest {
  type?: 'standard' | 'deep';
}

/**
 * Cron job response
 */
export interface CronJobResponse {
  success: boolean;
  timestamp: string;
  collectionType: string;
  results: Array<{
    industry: string;
    country: string;
    success: boolean;
    eventsFound?: number;
    eventsStored?: number;
    error?: string;
    enhancement?: any;
  }>;
  summary: {
    totalJobs: number;
    successfulJobs: number;
    totalEventsCollected: number;
    industries: number;
    countries: number;
    monthsAhead: number;
  };
}

/**
 * Chat request
 */
export interface ChatRequest {
  userText: string;
}

/**
 * Chat response
 */
export interface ChatResponse {
  text: string;
}

/**
 * Authentication test response
 */
export interface AuthTestResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email?: string;
  };
  session?: any;
}

/**
 * Session fix request
 */
export interface SessionFixRequest {
  // No specific parameters needed
}

/**
 * Session fix response
 */
export interface SessionFixResponse {
  success: boolean;
  message: string;
  session?: any;
}

/**
 * Test user creation request
 */
export interface TestUserCreateRequest {
  email: string;
  password: string;
}

/**
 * Test user creation response
 */
export interface TestUserCreateResponse {
  status: 'success' | 'error';
  message: string;
  user?: any;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
  stack?: string; // Only in development
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code: string;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse extends ErrorResponse {
  code: 'VALIDATION_ERROR';
  details: {
    errors: ValidationError[];
    schema: string;
  };
}

/**
 * API endpoint metadata
 */
export interface ApiEndpointInfo {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requiresAuth: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
}
