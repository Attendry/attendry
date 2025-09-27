/**
 * Validation Schemas for Attendry Application
 * 
 * This file contains Zod validation schemas for all API endpoints,
 * ensuring type safety and input validation across the application.
 */

import { z } from 'zod';

/**
 * Common validation patterns
 */
const urlSchema = z.string().url('Invalid URL format');
const emailSchema = z.string().email('Invalid email format');
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
const countryCodeSchema = z.string().length(2, 'Country code must be 2 characters');
const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Event Search Request Schema
 */
export const eventSearchRequestSchema = z.object({
  q: z.string().optional().default(''),
  country: z.string().optional().default(''),
  from: dateSchema,
  to: dateSchema,
  provider: z.enum(['cse', 'firecrawl', 'enhanced']).optional().default('cse'),
  num: z.number().int().min(1).max(100).optional().default(10),
  rerank: z.boolean().optional().default(false),
  topK: z.number().int().min(1).max(100).optional().default(50),
}).refine(
  (data) => new Date(data.from) <= new Date(data.to),
  {
    message: "Start date must be before or equal to end date",
    path: ["from", "to"],
  }
);

/**
 * Event Extraction Request Schema
 */
export const eventExtractionRequestSchema = z.object({
  urls: z.array(urlSchema).min(1, 'At least one URL is required').max(20, 'Maximum 20 URLs allowed'),
  locale: z.string().optional().default(''),
  crawl: z.boolean().optional().default(false),
});

/**
 * Speaker Extraction Request Schema
 */
export const speakerExtractionRequestSchema = z.object({
  url: urlSchema,
  includePast: z.boolean().optional().default(false),
});

/**
 * Event Discovery Request Schema
 */
export const eventDiscoveryRequestSchema = z.object({
  q: z.string().optional().default(''),
  country: z.string().optional().default(''),
  from: dateSchema,
  to: dateSchema,
  provider: z.string().optional().default('cse'),
}).refine(
  (data) => new Date(data.from) <= new Date(data.to),
  {
    message: "Start date must be before or equal to end date",
    path: ["from", "to"],
  }
);

/**
 * Profile Save Request Schema
 */
export const profileSaveRequestSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100, 'Full name too long').optional(),
  company: z.string().max(100, 'Company name too long').optional(),
  competitors: z.array(z.string().max(100, 'Competitor name too long')).max(20, 'Maximum 20 competitors allowed').optional().default([]),
  icp_terms: z.array(z.string().max(100, 'ICP term too long')).max(50, 'Maximum 50 ICP terms allowed').optional().default([]),
  industry_terms: z.array(z.string().max(100, 'Industry term too long')).max(50, 'Maximum 50 industry terms allowed').optional().default([]),
  use_in_basic_search: z.boolean().optional().default(true),
});

/**
 * Watchlist Add Request Schema
 */
export const watchlistAddRequestSchema = z.object({
  kind: z.enum(['event', 'speaker', 'organization']),
  label: z.string().max(200, 'Label too long').optional(),
  ref_id: z.string().min(1, 'Reference ID is required').max(500, 'Reference ID too long'),
});

/**
 * Watchlist Remove Request Schema
 */
export const watchlistRemoveRequestSchema = z.object({
  kind: z.enum(['event', 'speaker', 'organization']).optional().default('event'),
  ref_id: z.string().min(1, 'Reference ID is required').max(500, 'Reference ID too long'),
});

/**
 * Configuration Save Request Schema
 */
export const configSaveRequestSchema = z.object({
  name: z.string().min(1, 'Configuration name is required').max(100, 'Name too long'),
  industry: z.string().min(1, 'Industry is required').max(100, 'Industry name too long'),
  baseQuery: z.string().min(1, 'Base query is required').max(500, 'Base query too long'),
  excludeTerms: z.string().max(1000, 'Exclude terms too long').optional().default(''),
  industryTerms: z.array(z.string().max(100, 'Industry term too long')).max(100, 'Maximum 100 industry terms allowed').optional().default([]),
  icpTerms: z.array(z.string().max(100, 'ICP term too long')).max(100, 'Maximum 100 ICP terms allowed').optional().default([]),
  is_active: z.boolean().optional().default(true),
});

/**
 * Cron Job Request Schema
 */
export const cronJobRequestSchema = z.object({
  type: z.enum(['standard', 'deep']).optional().default('standard'),
});

/**
 * Chat Request Schema
 */
export const chatRequestSchema = z.object({
  userText: z.string().min(1, 'User text is required').max(2000, 'User text too long'),
});

/**
 * Test User Creation Request Schema
 */
export const testUserCreateRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(100, 'Password too long'),
});

/**
 * Session Fix Request Schema
 */
export const sessionFixRequestSchema = z.object({
  // No specific parameters needed
}).strict();

/**
 * Event Data Schema (for validation of extracted events)
 */
export const eventDataSchema = z.object({
  id: z.string().optional(),
  source_url: urlSchema,
  title: z.string().min(1, 'Event title is required').max(500, 'Event title too long'),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  city: z.string().max(100, 'City name too long').nullable().optional(),
  country: z.string().max(100, 'Country name too long').nullable().optional(),
  venue: z.string().max(200, 'Venue name too long').nullable().optional(),
  organizer: z.string().max(200, 'Organizer name too long').nullable().optional(),
  description: z.string().max(5000, 'Description too long').nullable().optional(),
  topics: z.array(z.string().max(100, 'Topic too long')).max(50, 'Maximum 50 topics allowed').optional().default([]),
  speakers: z.array(z.object({
    name: z.string().min(1, 'Speaker name is required').max(200, 'Speaker name too long'),
    org: z.string().max(200, 'Organization name too long').optional(),
    title: z.string().max(200, 'Title too long').optional(),
    profile_url: urlSchema.optional(),
    source_url: urlSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
    session: z.string().max(200, 'Session name too long').optional(),
    speech_title: z.string().max(300, 'Speech title too long').optional(),
    bio: z.string().max(2000, 'Bio too long').optional(),
    linkedin_url: urlSchema.optional(),
    twitter_url: urlSchema.optional(),
    email: emailSchema.optional(),
  })).max(100, 'Maximum 100 speakers allowed').optional().default([]),
  sponsors: z.array(z.object({
    name: z.string().min(1, 'Sponsor name is required').max(200, 'Sponsor name too long'),
    level: z.string().max(50, 'Sponsor level too long').optional(),
    logo_url: urlSchema.optional(),
    website_url: urlSchema.optional(),
    description: z.string().max(1000, 'Sponsor description too long').optional(),
  })).max(50, 'Maximum 50 sponsors allowed').optional().default([]),
  participating_organizations: z.array(z.string().max(200, 'Organization name too long')).max(100, 'Maximum 100 organizations allowed').optional().default([]),
  partners: z.array(z.string().max(200, 'Partner name too long')).max(50, 'Maximum 50 partners allowed').optional().default([]),
  competitors: z.array(z.string().max(200, 'Competitor name too long')).max(50, 'Maximum 50 competitors allowed').optional().default([]),
  confidence: z.number().min(0).max(1).optional(),
  data_completeness: z.number().min(0).max(1).optional(),
  verification_status: z.enum(['unverified', 'verified', 'outdated']).optional().default('unverified'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Search Result Item Schema
 */
export const searchResultItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  link: urlSchema,
  snippet: z.string().max(2000, 'Snippet too long'),
  extractedData: z.object({
    eventTitle: z.string().max(500, 'Event title too long').optional(),
    eventDate: z.string().optional(),
    location: z.string().max(200, 'Location too long').optional(),
    organizer: z.string().max(200, 'Organizer too long').optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
});

/**
 * User Profile Schema
 */
export const userProfileSchema = z.object({
  id: z.string().optional(),
  full_name: z.string().max(100, 'Full name too long').optional(),
  company: z.string().max(100, 'Company name too long').optional(),
  competitors: z.array(z.string().max(100, 'Competitor name too long')).max(20, 'Maximum 20 competitors allowed').optional().default([]),
  icp_terms: z.array(z.string().max(100, 'ICP term too long')).max(50, 'Maximum 50 ICP terms allowed').optional().default([]),
  industry_terms: z.array(z.string().max(100, 'Industry term too long')).max(50, 'Maximum 50 industry terms allowed').optional().default([]),
  use_in_basic_search: z.boolean().optional().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Watchlist Item Schema
 */
export const watchlistItemSchema = z.object({
  id: z.string().optional(),
  owner: z.string().min(1, 'Owner is required'),
  kind: z.enum(['event', 'speaker', 'organization']),
  label: z.string().max(200, 'Label too long').optional(),
  ref_id: z.string().min(1, 'Reference ID is required').max(500, 'Reference ID too long'),
  created_at: z.string().optional(),
});

/**
 * Search Configuration Schema
 */
export const searchConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Configuration name is required').max(100, 'Name too long'),
  industry: z.string().min(1, 'Industry is required').max(100, 'Industry name too long'),
  baseQuery: z.string().min(1, 'Base query is required').max(500, 'Base query too long'),
  excludeTerms: z.string().max(1000, 'Exclude terms too long').optional().default(''),
  industryTerms: z.array(z.string().max(100, 'Industry term too long')).max(100, 'Maximum 100 industry terms allowed').optional().default([]),
  icpTerms: z.array(z.string().max(100, 'ICP term too long')).max(100, 'Maximum 100 ICP terms allowed').optional().default([]),
  is_active: z.boolean().optional().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Health Status Schema
 */
export const healthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);

/**
 * Service Health Schema
 */
export const serviceHealthSchema = z.object({
  status: healthStatusSchema,
  response_time_ms: z.number().min(0).optional(),
  last_error: z.string().optional(),
  details: z.any().optional(),
});

/**
 * Health Check Response Schema
 */
export const healthCheckResponseSchema = z.object({
  status: healthStatusSchema,
  timestamp: z.string(),
  services: z.object({
    google_cse: serviceHealthSchema,
    firecrawl: serviceHealthSchema,
    firecrawl_search: serviceHealthSchema,
    gemini: serviceHealthSchema,
    batch_gemini: serviceHealthSchema,
    token_budget: serviceHealthSchema,
    database: serviceHealthSchema,
    retry_service: serviceHealthSchema,
  }),
  metrics: z.object({
    retry_attempts: z.number().min(0),
    retry_failures: z.number().min(0),
    cache_hits: z.number().min(0),
    cache_misses: z.number().min(0),
  }),
  response_time_ms: z.number().min(0).optional(),
});

/**
 * API Response Schema
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

/**
 * Validation Error Schema
 */
export const validationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  value: z.any().optional(),
  code: z.string(),
});

/**
 * Validation Error Response Schema
 */
export const validationErrorResponseSchema = z.object({
  error: z.string(),
  code: z.literal('VALIDATION_ERROR'),
  details: z.object({
    errors: z.array(validationErrorSchema),
    schema: z.string(),
  }),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

/**
 * Export all schemas for use in validation middleware
 */
export const schemas = {
  eventSearchRequest: eventSearchRequestSchema,
  eventExtractionRequest: eventExtractionRequestSchema,
  speakerExtractionRequest: speakerExtractionRequestSchema,
  eventDiscoveryRequest: eventDiscoveryRequestSchema,
  profileSaveRequest: profileSaveRequestSchema,
  watchlistAddRequest: watchlistAddRequestSchema,
  watchlistRemoveRequest: watchlistRemoveRequestSchema,
  configSaveRequest: configSaveRequestSchema,
  cronJobRequest: cronJobRequestSchema,
  chatRequest: chatRequestSchema,
  testUserCreateRequest: testUserCreateRequestSchema,
  sessionFixRequest: sessionFixRequestSchema,
  eventData: eventDataSchema,
  searchResultItem: searchResultItemSchema,
  userProfile: userProfileSchema,
  watchlistItem: watchlistItemSchema,
  searchConfig: searchConfigSchema,
  healthCheckResponse: healthCheckResponseSchema,
  apiResponse: apiResponseSchema,
  validationErrorResponse: validationErrorResponseSchema,
} as const;

/**
 * Type exports for use with TypeScript
 */
export type EventSearchRequest = z.infer<typeof eventSearchRequestSchema>;
export type EventExtractionRequest = z.infer<typeof eventExtractionRequestSchema>;
export type SpeakerExtractionRequest = z.infer<typeof speakerExtractionRequestSchema>;
export type EventDiscoveryRequest = z.infer<typeof eventDiscoveryRequestSchema>;
export type ProfileSaveRequest = z.infer<typeof profileSaveRequestSchema>;
export type WatchlistAddRequest = z.infer<typeof watchlistAddRequestSchema>;
export type WatchlistRemoveRequest = z.infer<typeof watchlistRemoveRequestSchema>;
export type ConfigSaveRequest = z.infer<typeof configSaveRequestSchema>;
export type CronJobRequest = z.infer<typeof cronJobRequestSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type TestUserCreateRequest = z.infer<typeof testUserCreateRequestSchema>;
export type SessionFixRequest = z.infer<typeof sessionFixRequestSchema>;
export type EventData = z.infer<typeof eventDataSchema>;
export type SearchResultItem = z.infer<typeof searchResultItemSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type WatchlistItem = z.infer<typeof watchlistItemSchema>;
export type SearchConfig = z.infer<typeof searchConfigSchema>;
export type HealthCheckResponse = z.infer<typeof healthCheckResponseSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;
