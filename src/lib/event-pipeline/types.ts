/**
 * Event Pipeline Types
 * 
 * Core types for the new event discovery and extraction pipeline
 * that replaces the complex multi-tier enrichment process.
 */

import type { CountryContext } from '@/lib/utils/country';
import type { ConfidenceLevel } from '@/search/types';

// Core pipeline configuration
export interface EventPipelineConfig {
  thresholds: {
    prioritization: number;    // 0.6 - minimum score to proceed from prioritization
    confidence: number;        // 0.7 - minimum confidence to publish
    parseQuality: number;      // 0.5 - minimum parse quality
  };
  sources: {
    cse: boolean;              // Google Custom Search Engine
    firecrawl: boolean;        // Firecrawl for site maps, agenda pages, PDFs
    curated: boolean;          // Curated seed list (venues, orgs, event platforms)
  };
  limits: {
    maxCandidates: number;     // 50 - max URLs to discover
    maxExtractions: number;    // 10 - max events to extract
  };
  timeouts: {
    discovery: number;         // 30000ms - discovery timeout
    prioritization: number;    // 15000ms - prioritization timeout per batch
    parsing: number;           // 10000ms - parsing timeout per URL
  };
}

// Pipeline status tracking
export type PipelineStatus = 
  | 'discovered'     // URL discovered from source
  | 'prioritized'    // Passed LLM prioritization
  | 'parsed'         // Successfully parsed with deterministic rules
  | 'extracted'      // Enhanced with LLM extraction
  | 'resolved'       // Canonicalized and enriched
  | 'published'      // Published to final results
  | 'rejected'       // Rejected at any stage
  | 'failed';        // Failed processing

// Main event candidate through the pipeline
export interface EventCandidate {
  id: string;                 // Unique identifier
  url: string;                // Source URL
  source: 'cse' | 'firecrawl' | 'curated';
  discoveredAt: Date;         // When discovered
  priorityScore?: number;     // LLM prioritization score (0-1)
  parseResult?: ParseResult;  // Deterministic parsing result
  extractResult?: ExtractResult; // LLM-enhanced extraction result
  relatedUrls?: string[];     // Related pages discovered for enrichment
  confidence?: number;        // Final confidence score
  status: PipelineStatus;     // Current pipeline status
  dateISO?: string | null;
  dateConfidence?: ConfidenceLevel;
  candidateScore?: number;
  metadata: {
    originalQuery: string;    // Original search query
    country: string | null;   // Target country (null for pan-European searches)
    processingTime: number;   // Total processing time in ms
    stageTimings: {           // Timing for each stage
      discovery?: number;
      prioritization?: number;
      parsing?: number;
      extraction?: number;
    };
    geoReason?: string;
    dateReason?: string;
    // Scraped content fields for content-based prioritization
    title?: string;
    description?: string;
    scrapedContent?: string;
    scrapedLinks?: string[];
  };
}

// Speaker information structure
export interface SpeakerInfo {
  name: string;
  title?: string;
  company?: string;
}

// Deterministic parsing result
export interface ParseResult {
  title?: string;
  description?: string;
  date?: string;
  startISO?: string | null;
  endISO?: string | null;
  dateConfidence?: 'high' | 'low';
  location?: string;
  venue?: string;
  speakers?: string[] | SpeakerInfo[];  // Support both formats
  agenda?: string[];
  confidence: number;         // Confidence in parsing result (0-1)
  evidence: Evidence[];       // Evidence for each extracted field
  parseMethod: 'deterministic' | 'llm_enhanced';
  parseErrors?: string[];     // Any parsing errors encountered
  enhancementNotes?: string;  // Notes about enhancements made
}

// LLM-enhanced extraction result
export interface ExtractResult extends ParseResult {
  llmEnhanced: boolean;       // Whether LLM enhancement was applied
  schemaValidated: boolean;   // Whether result passed schema validation
  validationErrors?: string[]; // Schema validation errors
  llmConfidence?: number;     // LLM's confidence in extraction
  enhancementNotes?: string;  // Notes about what was enhanced
}

// Evidence for extracted data
export interface Evidence {
  field: string;              // Field name (title, date, etc.)
  value: string;              // Extracted value
  source: 'html' | 'pdf' | 'microdata' | 'llm' | 'regex';
  selector?: string;          // CSS/XPath selector used
  quotedText: string;         // Exact quoted text from source
  confidence: number;         // Confidence in this evidence (0-1)
  timestamp: Date;            // When evidence was collected
  context?: string;           // Additional context about extraction
}

// Prioritization scoring result
export interface PrioritizationScore {
  is_event: number;           // Is this an event page? (0-1)
  has_agenda: number;         // Does it have agenda/program info? (0-1)
  has_speakers: number;       // Does it have speaker information? (0-1)
  is_recent: number;          // Is this for a current/future event? (0-1)
  is_relevant: number;        // Does it match compliance/legal themes? (0-1)
  is_country_relevant?: number; // Does this event appear to be in the target country? (0-1) - optional for country-specific searches
  overall: number;            // Weighted overall score (0-1)
}

// Pipeline stage result
export interface StageResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;           // Processing time in ms
  metadata?: Record<string, any>;
}

// Pipeline execution context
export interface PipelineContext {
  query: string;
  country: string | null;
  countryContext: CountryContext | null;
  dateFrom?: string;
  dateTo?: string;
  locale?: string;
  startTime: Date;
  config: EventPipelineConfig;
  telemetry?: PipelineTelemetry;
}

export type DiscoveryTelemetry = {
  count: number;
  durationMs: number;
  timeout: boolean;
};

export type PipelineTelemetry = {
  adapters: {
    cse?: DiscoveryTelemetry;
    firecrawl?: DiscoveryTelemetry;
    curated?: DiscoveryTelemetry;
  };
};

// Service interfaces for dependency injection
export interface DiscoveryService {
  search(params: {
    q: string;
    country: string | null;
    limit?: number;
    countryContext?: CountryContext | null;
    from?: string;
    to?: string;
  }): Promise<{ items: Array<{ url: string; title?: string; description?: string; relatedUrls?: string[]; extractedData?: { eventDate?: string; confidence?: number } }> }>;
}

export interface PrioritizationService {
  scoreCandidate(candidate: EventCandidate): Promise<PrioritizationScore>;
}

export interface ParsingService {
  parse(candidate: EventCandidate): Promise<ParseResult>;
}

// Pipeline metrics for monitoring
export interface PipelineMetrics {
  totalCandidates: number;
  prioritizedCandidates: number;
  parsedCandidates: number;
  extractedCandidates: number;
  publishedCandidates: number;
  rejectedCandidates: number;
  failedCandidates: number;
  totalDuration: number;
  averageConfidence: number;
  sourceBreakdown: Record<string, number>;
}

export interface PipelineResult {
  candidates: EventCandidate[];
  publishedEvents: PublishedEvent[];
  metrics: PipelineMetrics;
  logs: any[];
  providersTried: string[];
}

// Error types for better error handling
export class PipelineError extends Error {
  constructor(
    message: string,
    public stage: string,
    public candidate?: EventCandidate,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

export class DiscoveryError extends PipelineError {
  constructor(message: string, candidate?: EventCandidate, originalError?: Error) {
    super(message, 'discovery', candidate, originalError);
    this.name = 'DiscoveryError';
  }
}

export class PrioritizationError extends PipelineError {
  constructor(message: string, candidate?: EventCandidate, originalError?: Error) {
    super(message, 'prioritization', candidate, originalError);
    this.name = 'PrioritizationError';
  }
}

export class ParsingError extends PipelineError {
  constructor(message: string, candidate?: EventCandidate, originalError?: Error) {
    super(message, 'parsing', candidate, originalError);
    this.name = 'ParsingError';
  }
}
