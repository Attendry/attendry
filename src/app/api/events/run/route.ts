// app/api/events/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeOptimizedSearch, type OptimizedSearchResult, type EventCandidate } from '@/lib/optimized-orchestrator';
import { deriveLocale, getCountryContext, isValidISO2Country, toISO2Country } from '@/lib/utils/country';
import { supabaseServer } from '@/lib/supabase-server';
import { createHash } from 'crypto';
import { RelevanceService, type UserProfile, type RelevanceScore } from '@/lib/services/relevance-service';

// Legacy event format for API compatibility
interface LegacyEvent {
  id: string;
  title: string;
  source_url: string;
  starts_at: string | null;
  ends_at?: string | null;
  country: string;
  city: string;
  location: string;
  venue: string;
  organizer: string;
  description: string;
  confidence: number;
  topics: string[];
  sessions: unknown[];
  speakers: unknown[];
  sponsors: unknown[];
  participating_organizations: string[];
  partners: string[];
  competitors: string[];
  metadata: {
    source: string;
    processingTime: number;
    dateStatus: 'extracted' | 'unknown';
    [key: string]: unknown;
  };
  // Relevance scoring fields (added after processing)
  relevance_score?: number | null;
  relevance_reasons?: string[];
  relevance_matched_terms?: {
    industry: string[];
    icp: string[];
    competitors: string[];
  };
}

interface ProcessedResults {
  events: LegacyEvent[];
  provider: string;
  count: number;
  pipeline_metrics: {
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
  };
  logs: Array<{ stage: string; message: string; timestamp: string; data?: unknown }>;
  debug?: {
    optimizedResult: OptimizedSearchResult;
    processingTime: number;
  };
}

// Helper function to process Optimized Orchestrator results
export async function processOptimizedResults(
  optimizedResult: OptimizedSearchResult,
  country: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  includeDebug: boolean
): Promise<ProcessedResults> {
  const events = optimizedResult.events || [];
  
  // Convert Optimized Orchestrator events to legacy format
  const legacyEvents: LegacyEvent[] = events.map((event: EventCandidate, index: number) => {
    // Extract proper title from URL if title is missing or is a URL
    let eventTitle = event.title;
    if (!eventTitle || eventTitle.startsWith('http') || eventTitle === event.url) {
      // Try to extract title from URL or use a default
      try {
        const url = new URL(event.url);
        const hostname = url.hostname.replace('www.', '');
        const pathParts = url.pathname.split('/').filter(part => part.length > 0);
        
        if (pathParts.length > 0) {
          // Use the last meaningful path segment as title
          const lastPart = pathParts[pathParts.length - 1];
          eventTitle = lastPart.replace(/[-_]/g, ' ').replace(/\.[^.]*$/, ''); // Remove file extensions
        } else {
          eventTitle = hostname.replace(/\./g, ' '); // Use hostname as fallback
        }
        
        // Capitalize first letter of each word
        eventTitle = eventTitle.split(' ').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      } catch (e) {
        eventTitle = 'Event';
      }
    }
    
    // Generate unique ID: use crypto hash of URL + timestamp + index for guaranteed uniqueness
    // This ensures each event gets a truly unique ID even if processed in same millisecond
    const sourceUrl = event.url || '';
    const timestamp = Date.now();
    const urlHash = sourceUrl 
      ? createHash('sha256').update(sourceUrl).digest('hex').slice(0, 12)
      : createHash('sha256').update(`${timestamp}_${index}`).digest('hex').slice(0, 12);
    const uniqueId = `optimized_${timestamp}_${index}_${urlHash}`;
    
    // CRITICAL FIX: Don't default to today's date - this was causing events to show incorrect dates
    // If date extraction failed, leave it null so UI can show "Date TBD"
    // Validate that event.date is a valid date string before using it
    let eventDate: string | null = null;
    if (event.date && typeof event.date === 'string') {
      const trimmedDate = event.date.trim();
      if (trimmedDate && trimmedDate !== 'Unknown Date' && trimmedDate !== 'TBD') {
        // Basic validation: check if it's a valid date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}/; // ISO date format
        if (dateRegex.test(trimmedDate)) {
          eventDate = trimmedDate;
        }
      }
    }
    
    return {
      id: uniqueId,
      title: eventTitle,
      source_url: event.url,
      starts_at: eventDate,
      country: country || event.country || 'EU',
      city: event.city || extractCityFromLocation(event.location),
      location: event.location || 'Location TBD',
      venue: event.venue || 'Venue TBD',
      organizer: event.metadata?.analysis?.organizer || 'Event Organizer',
      description: event.description || 'Event description not available',
      confidence: event.confidence || 0.5,
      topics: extractTopicsFromDescription(event.description),
      sessions: [],
      speakers: event.speakers || [],
      sponsors: event.sponsors || [],
      participating_organizations: [] as string[],
      partners: [] as string[],
      competitors: [] as string[],
      metadata: {
        ...event.metadata,
        source: 'optimized_orchestrator',
        processingTime: event.metadata?.processingTime || 0,
        dateStatus: eventDate ? 'extracted' : 'unknown' // Track if date was extracted or not
      }
    };
  });

  return {
    events: legacyEvents,
    provider: 'optimized_orchestrator',
    count: legacyEvents.length,
    pipeline_metrics: {
      totalCandidates: optimizedResult.metadata?.totalCandidates || 0,
      prioritizedCandidates: optimizedResult.metadata?.prioritizedCandidates || 0,
      parsedCandidates: optimizedResult.metadata?.extractedCandidates || 0,
      extractedCandidates: optimizedResult.metadata?.extractedCandidates || 0,
      publishedCandidates: optimizedResult.metadata?.enhancedCandidates || 0,
      rejectedCandidates: 0,
      failedCandidates: 0,
      totalDuration: optimizedResult.metadata?.totalDuration || 0,
      averageConfidence: optimizedResult.metadata?.averageConfidence || 0,
      sourceBreakdown: optimizedResult.metadata?.sourceBreakdown || {}
    },
    logs: optimizedResult.logs || [],
    debug: includeDebug ? {
      optimizedResult,
      processingTime: Date.now()
    } : undefined
  };
}

// Helper function to extract city from location string
function extractCityFromLocation(location?: string): string {
  if (!location) return 'City TBD';
  const parts = location.split(',');
  return parts[0]?.trim() || 'City TBD';
}

// Helper function to extract topics from description
function extractTopicsFromDescription(description?: string): string[] {
  if (!description) return ['General'];
  
  const commonTopics = [
    'Legal', 'Compliance', 'Technology', 'Business', 'Finance',
    'Data Privacy', 'Cybersecurity', 'Regulatory', 'Risk Management'
  ];
  
  const foundTopics = commonTopics.filter(topic => 
    description.toLowerCase().includes(topic.toLowerCase())
  );
  
  return foundTopics.length > 0 ? foundTopics : ['General'];
}

// Helper function to save search results asynchronously
// Note: This runs in background and errors are logged but don't affect the main response
async function saveSearchResultsAsync(params: {
  userText: string;
  country: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  locale: string;
  results: LegacyEvent[];
  searchDuration: number;
  apiEndpoint: string;
}): Promise<void> {
  try {
    // Validate inputs
    if (!params.results || !Array.isArray(params.results) || params.results.length === 0) {
      return;
    }

    const supabase = await supabaseServer();
    if (!supabase) {
      // Non-critical: Supabase unavailable, skip saving
      return;
    }

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    // Only save if user is authenticated
    if (userErr || !userRes?.user) {
      // Non-critical: User not authenticated, skip saving
      return;
    }

    const searchParams = {
      keywords: params.userText || '',
      country: params.country || 'EU',
      from: params.dateFrom || '',
      to: params.dateTo || '',
      timestamp: Date.now(),
    };

    // Ensure results are serializable
    const serializableResults = params.results.map(event => ({
      id: event.id,
      title: event.title,
      source_url: event.source_url,
      starts_at: event.starts_at,
      country: event.country,
      city: event.city,
      location: event.location,
      venue: event.venue,
      organizer: event.organizer,
      description: event.description,
      confidence: event.confidence,
      topics: event.topics,
      speakers: event.speakers,
      sponsors: event.sponsors
    }));

    const { error } = await supabase
      .from('user_search_results')
      .insert({
        user_id: userRes.user.id,
        search_params: searchParams,
        results: serializableResults,
        result_count: serializableResults.length,
        search_duration_ms: params.searchDuration,
        api_endpoint: params.apiEndpoint
      });

    if (error) {
      // Log error with context for monitoring, but don't throw (background operation)
      console.error('[api/events/run] Failed to save search history:', {
        error: error.message,
        code: error.code,
        details: error.details,
        resultCount: serializableResults.length
      });
    }
    // Success case: no logging needed for background operations to reduce noise
  } catch (error) {
    // Log unexpected errors with full context
    console.error('[api/events/run] Unexpected error saving search history:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      resultCount: params.results?.length || 0
    });
  }
}

interface TelemetryData {
  ctx: {
    country?: string;
    locale?: string;
    tld?: string;
  };
  query: {
    base?: string;
    final?: string;
  };
  adapters: {
    firecrawl?: number;
    cse?: number;
    database?: number;
  };
  results: {
    count?: number;
    provider?: string;
  };
  timeouts: Record<string, unknown>;
  fallbackUsed: boolean;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const telemetry: TelemetryData = {
    ctx: {},
    query: {},
    adapters: {},
    results: {},
    timeouts: {},
    fallbackUsed: false
  };

  try {
    const body = await req.json();
    const userText: string = body?.userText ?? '';
    const rawCountry = body?.country ?? '';
    const normalizedCountry = rawCountry ? toISO2Country(rawCountry) : null;
    
    // API Guard: Reject invalid country codes
    if (!isValidISO2Country(normalizedCountry)) {
      return NextResponse.json({ error: 'country (ISO2) required' }, { status: 400 });
    }
    
    const ctx = getCountryContext(normalizedCountry);
    const requestedLocale = body?.locale ?? '';
    const locale = deriveLocale(normalizedCountry ?? undefined, requestedLocale ?? undefined);
    
    const dateFrom: string | null = body?.dateFrom ?? null;
    const dateTo: string | null = body?.dateTo ?? null;
    const location: string | null = body?.location ?? null;
    const timeframe: string | null = body?.timeframe ?? null;
    const includeDebug = body?.debug === true;
    const useNaturalLanguage = body?.useNaturalLanguage === true; // Flag to skip profile enrichment for NLP

    // Initialize telemetry context
    telemetry.ctx = {
      country: ctx.iso2,
      locale: ctx.locale,
      tld: ctx.tld
    };
    telemetry.query = {
      base: userText,
      final: ''
    };

    console.log('[api/events/run] Starting search with params:', {
      userText,
      country: normalizedCountry,
      dateFrom,
      dateTo,
      locale,
      location,
      timeframe
    });

    // Process timeframe to date range
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;
    
    if (timeframe && !dateFrom && !dateTo) {
      // Simple timeframe processing
      const now = new Date();
      switch (timeframe) {
        case 'next_7':
          effectiveDateFrom = now.toISOString().split('T')[0];
          effectiveDateTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'next_30':
          effectiveDateFrom = now.toISOString().split('T')[0];
          effectiveDateTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'next_90':
          effectiveDateFrom = now.toISOString().split('T')[0];
          effectiveDateTo = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
      }
    } else if (!timeframe && !dateFrom && !dateTo) {
      // Only apply date restrictions for specific country searches
      if (normalizedCountry && normalizedCountry !== 'EU') {
        // Default to next 30 days only for specific country searches
        const now = new Date();
        effectiveDateFrom = now.toISOString().split('T')[0];
        effectiveDateTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else {
        // No date restrictions for pan-European searches
        effectiveDateFrom = null;
        effectiveDateTo = null;
      }
    }

    // Check if external search providers are configured
    const hasFirecrawl = !!process.env.FIRECRAWL_KEY;
    const hasGoogleCSE = !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX);
    
    // Use mock data if no search providers are configured
    if (!hasFirecrawl && !hasGoogleCSE) {
      console.log('[api/events/run] No search providers configured, using mock data');
      const { getMockEvents } = await import('./test-data');
      const mockEvents = getMockEvents({ userText, country: normalizedCountry || undefined });
      
      return NextResponse.json({
        count: mockEvents.length,
        events: mockEvents,
        country: normalizedCountry,
        provider: 'mock',
        effectiveQ: userText,
        searchRetriedWithBase: false,
        _dev_mode: true,
        _message: 'Using mock data. Configure FIRECRAWL_KEY or GOOGLE_CSE_KEY for real results.'
      });
    }

    // Use Optimized Orchestrator
    console.log('[api/events/run] Using Optimized Orchestrator', { useNaturalLanguage });
    const res = await executeOptimizedSearch({
      userText,
      country: normalizedCountry,
      dateFrom: effectiveDateFrom || undefined,
      dateTo: effectiveDateTo || undefined,
      location,
      timeframe,
      locale,
      useNaturalLanguage
    });
    
    telemetry.query.final = userText; // Optimized orchestrator uses the original query
    telemetry.adapters.firecrawl = res?.metadata?.sourceBreakdown?.firecrawl || 0;
    telemetry.adapters.cse = res?.metadata?.sourceBreakdown?.cse || 0;
    telemetry.adapters.database = res?.metadata?.sourceBreakdown?.database || 0;
    
    console.log('[api/events/run] Search completed, processing results...');
    
    // Convert Optimized Orchestrator results to legacy format
    const result = await processOptimizedResults(res, normalizedCountry, dateFrom, dateTo, includeDebug);

    // Optimized Orchestrator already includes speaker enhancement
    console.log(`[api/events/run] Optimized Orchestrator completed with ${result.events?.length || 0} enhanced events`);

    // Calculate relevance scores if user profile is available (skip for natural language queries)
    if (result.events && result.events.length > 0 && !useNaturalLanguage) {
      try {
        const supabase = await supabaseServer();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userProfile = await RelevanceService.getUserProfile(user.id);
          if (userProfile) {
            // Convert events to EventData format for RelevanceService
            const eventDataForScoring = result.events.map((event: LegacyEvent) => ({
              id: event.id || event.source_url,
              title: event.title || 'Event',
              starts_at: event.starts_at || undefined,
              ends_at: event.ends_at || undefined,
              city: event.city || undefined,
              country: event.country || undefined,
              venue: event.venue || undefined,
              organizer: event.organizer || undefined,
              description: event.description || undefined,
              topics: event.topics || undefined,
              speakers: event.speakers || [],
              sponsors: event.sponsors || [],
              participating_organizations: event.participating_organizations || undefined,
              partners: event.partners || undefined,
              competitors: event.competitors || undefined,
              confidence: event.confidence || undefined,
              data_completeness: undefined,
            } as const));

            // Calculate relevance scores
            const relevanceScores = await RelevanceService.calculateRelevanceScores(
              eventDataForScoring,
              userProfile
            );

            // Create a map of eventId -> relevance score
            const scoreMap = new Map<string, RelevanceScore>();
            relevanceScores.forEach(score => {
              scoreMap.set(score.eventId, score);
            });

            // Attach relevance scores to events and sort by relevance
            result.events = result.events
              .map((event: LegacyEvent): LegacyEvent => {
                const eventId = event.id || event.source_url;
                const relevanceScore = scoreMap.get(eventId);
                
                return {
                  ...event,
                  relevance_score: relevanceScore ? Math.round(relevanceScore.score * 100) : null,
                  relevance_reasons: relevanceScore?.reasons || [],
                  relevance_matched_terms: relevanceScore?.matchedTerms || {
                    industry: [],
                    icp: [],
                    competitors: [],
                  },
                };
              })
              .sort((a: LegacyEvent, b: LegacyEvent) => {
                // Sort by relevance score (highest first), then by confidence, then by date
                const scoreA = a.relevance_score ?? 0;
                const scoreB = b.relevance_score ?? 0;
                if (scoreB !== scoreA) {
                  return scoreB - scoreA;
                }
                const confA = a.confidence ?? 0;
                const confB = b.confidence ?? 0;
                if (confB !== confA) {
                  return confB - confA;
                }
                // Sort by date (upcoming first)
                const dateA = a.starts_at ? new Date(a.starts_at).getTime() : 0;
                const dateB = b.starts_at ? new Date(b.starts_at).getTime() : 0;
                return dateA - dateB;
              });

            console.log(`[api/events/run] Calculated relevance scores for ${result.events.length} events, sorted by relevance`);
          }
        }
      } catch (error) {
        console.warn('[api/events/run] Failed to calculate relevance scores, continuing without sorting:', error);
      }
    }

    // Save search results asynchronously
    if (result.events && result.events.length > 0) {
      saveSearchResultsAsync({
        userText,
        country: normalizedCountry,
        dateFrom: effectiveDateFrom,
        dateTo: effectiveDateTo,
        locale,
        results: result.events,
        searchDuration: Date.now() - startTime,
        apiEndpoint: '/api/events/run'
      }).catch(error => {
        // Error already logged in saveSearchResultsAsync, no need to log again
        // This catch prevents unhandled promise rejection
      });
    }

    const response = {
      ...result,
      telemetry: {
        ...telemetry,
        results: {
          count: result.events?.length || 0,
          duration: Date.now() - startTime
        }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[api/events/run] Search failed:', error);
    
    const errorResponse = {
      events: [],
      provider: 'optimized_orchestrator',
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      telemetry: {
        ...telemetry,
        results: {
          count: 0,
          duration: Date.now() - startTime,
          error: true
        }
      }
    };
    
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userText: string = url.searchParams.get('userText') ?? 'legal conference 2025';
    const rawCountry = url.searchParams.get('country');
    const normalizedCountry = rawCountry ? toISO2Country(rawCountry) : null;
    if (rawCountry && !normalizedCountry) {
      return NextResponse.json({ error: 'Invalid country parameter. Expect ISO-3166-1 alpha-2 code.' }, { status: 400 });
    }
    const dateFrom: string | null = url.searchParams.get('dateFrom');
    const dateTo: string | null = url.searchParams.get('dateTo');
    const requestedLocale = url.searchParams.get('locale');
    const locale = deriveLocale(normalizedCountry ?? undefined, requestedLocale ?? undefined);
    const location: string | null = url.searchParams.get('location');
    const timeframe: string | null = url.searchParams.get('timeframe');
    const includeDebug = url.searchParams.get('debug') === 'true';

    // Process timeframe to date range (same logic as POST)
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;
    
    if (timeframe && !dateFrom && !dateTo) {
      const now = new Date();
      switch (timeframe) {
        case 'next_7':
          effectiveDateFrom = now.toISOString().split('T')[0];
          effectiveDateTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'next_30':
          effectiveDateFrom = now.toISOString().split('T')[0];
          effectiveDateTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'next_90':
          effectiveDateFrom = now.toISOString().split('T')[0];
          effectiveDateTo = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
      }
    } else if (!timeframe && !dateFrom && !dateTo) {
      if (normalizedCountry && normalizedCountry !== 'EU') {
        const now = new Date();
        effectiveDateFrom = now.toISOString().split('T')[0];
        effectiveDateTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else {
        effectiveDateFrom = null;
        effectiveDateTo = null;
      }
    }

    // Check if external search providers are configured
    const hasFirecrawl = !!process.env.FIRECRAWL_KEY;
    const hasGoogleCSE = !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX);
    
    // Use mock data if no search providers are configured
    if (!hasFirecrawl && !hasGoogleCSE) {
      console.log('[api/events/run] No search providers configured, using mock data');
      const { getMockEvents } = await import('./test-data');
      const mockEvents = getMockEvents({ userText, country: normalizedCountry || undefined });
      
      return NextResponse.json({
        count: mockEvents.length,
        events: mockEvents,
        country: normalizedCountry,
        provider: 'mock',
        effectiveQ: userText,
        searchRetriedWithBase: false,
        _dev_mode: true,
        _message: 'Using mock data. Configure FIRECRAWL_KEY or GOOGLE_CSE_KEY for real results.'
      });
    }

    // Use Optimized Orchestrator
    console.log('[api/events/run] Using Optimized Orchestrator (GET)');
    const res = await executeOptimizedSearch({
      userText,
      country: normalizedCountry,
      dateFrom: effectiveDateFrom || undefined,
      dateTo: effectiveDateTo || undefined,
      location,
      timeframe,
      locale
    });
    
    const result = await processOptimizedResults(res, normalizedCountry, dateFrom, dateTo, includeDebug);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[api/events/run] GET search failed:', error);
    return NextResponse.json({ 
      events: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}