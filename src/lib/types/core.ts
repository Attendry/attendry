/**
 * Core Type Definitions for Attendry Application
 * 
 * This file contains the fundamental type definitions used throughout
 * the application for events, search, speakers, and API responses.
 */

/**
 * Core event data structure representing an event in the system
 */
export interface EventData {
  id?: string;
  source_url: string;
  title: string;
  starts_at?: string | null;
  ends_at?: string | null;
  city?: string | null;
  country?: string | null;
  venue?: string | null;
  organizer?: string | null;
  description?: string | null;
  topics?: string[];
  speakers?: SpeakerData[];
  sponsors?: SponsorData[];
  participating_organizations?: string[];
  partners?: string[];
  competitors?: string[];
  confidence?: number;
  data_completeness?: number;
  verification_status?: 'unverified' | 'verified' | 'outdated';
  created_at?: string;
  updated_at?: string;
}

/**
 * Speaker information extracted from events
 */
export interface SpeakerData {
  name: string;
  org?: string;
  title?: string;
  profile_url?: string;
  source_url?: string;
  confidence?: number;
  session?: string;
  speech_title?: string;
  bio?: string;
  linkedin_url?: string;
  twitter_url?: string;
  email?: string;
}

/**
 * Sponsor information for events
 */
export interface SponsorData {
  name: string;
  level?: string;
  logo_url?: string;
  website_url?: string;
  description?: string;
}

/**
 * Search parameters for event discovery
 */
export interface SearchParams {
  q: string;
  country: string;
  from: string;
  to: string;
  provider?: 'cse' | 'firecrawl' | 'enhanced';
  num?: number;
  rerank?: boolean;
  topK?: number;
}

/**
 * User profile information
 */
export interface UserProfile {
  id?: string;
  full_name?: string;
  company?: string;
  competitors?: string[];
  icp_terms?: string[];
  industry_terms?: string[];
  use_in_basic_search?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Search configuration for different industries
 */
export interface SearchConfig {
  id?: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Pagination information for list responses
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Search result item from external APIs
 */
export interface SearchResultItem {
  title: string;
  link: string;
  snippet: string;
  extractedData?: {
    eventTitle?: string;
    eventDate?: string;
    location?: string;
    organizer?: string;
    confidence?: number;
  };
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Service health information
 */
export interface ServiceHealth {
  status: HealthStatus;
  response_time_ms?: number;
  last_error?: string;
  details?: any;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

/**
 * Retry metrics for monitoring
 */
export interface RetryMetrics {
  attempts: number;
  totalDelayMs: number;
  lastError?: string;
  success: boolean;
  service: string;
  operation: string;
  timestamp: Date;
}

/**
 * Watchlist item structure
 */
export interface WatchlistItem {
  id?: string;
  owner: string;
  kind: 'event' | 'speaker' | 'organization';
  label?: string;
  ref_id: string;
  created_at?: string;
}

/**
 * Collection batch information for cron jobs
 */
export interface CollectionBatch {
  id?: string;
  industry: string;
  country: string;
  date_range_start: string;
  date_range_end: string;
  events_found: number;
  events_stored: number;
  events_updated: number;
  status: 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at?: string;
}
