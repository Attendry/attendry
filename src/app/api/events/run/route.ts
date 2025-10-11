// app/api/events/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeEnhancedSearch } from '@/common/search/enhanced-orchestrator';
import { loadActiveConfig, type ActiveConfig } from '@/common/search/config';

const DEMO_FALLBACK_EVENTS: Array<Omit<ApiEvent, 'id'>> = [
  {
    title: 'Legal Tech Conference 2025',
    source_url: 'https://legaltechconf.com/2025',
    starts_at: '2025-03-15',
    country: 'DE',
    city: 'Berlin',
    location: 'Berlin, Germany',
    venue: 'City Expo Center',
    description: 'Explore the latest in legal technology and innovation.',
    confidence: 0.6,
    sessions: [],
    speakers: [],
    sponsors: [],
  },
  {
    title: 'Regulatory Compliance Forum',
    source_url: 'https://regcompliance.eu',
    starts_at: '2025-05-12',
    country: 'DE',
    city: 'Frankfurt',
    location: 'Frankfurt, Germany',
    venue: 'Main Finance Hall',
    description: 'Financial services compliance best practices.',
    confidence: 0.55,
    sessions: [],
    speakers: [],
    sponsors: [],
  },
  {
    title: 'Data Privacy Summit Europe',
    source_url: 'https://dataprivacysummit.eu',
    starts_at: '2025-04-08',
    country: 'NL',
    city: 'Amsterdam',
    location: 'Amsterdam, Netherlands',
    venue: 'Innovation Center',
    description: 'GDPR compliance and data protection strategies.',
    confidence: 0.5,
    sessions: [],
    speakers: [],
    sponsors: [],
  },
];

function demoFallbackEnabled() {
  return process.env.SEARCH_ENABLE_DEMO_FALLBACK !== 'false';
}

function buildDemoFallback(country: string | null): ApiEvent[] {
  const normalized = country?.toUpperCase() ?? null;
  const base = DEMO_FALLBACK_EVENTS.map((event, index) => ({
    ...event,
    id: `${event.source_url}#demo-${index}`,
    confidence_reason: 'demo_fallback',
    countrySource: 'demo',
    citySource: 'demo',
    locationSource: 'demo',
  }));

  if (!normalized) return base;

  const filtered = base.filter((event) => event.country?.toUpperCase() === normalized);
  return filtered.length ? filtered : base;
}

type ApiSpeaker = {
  name: string | null;
  title: string | null;
  org: string | null;
  bio: string | null;
  confidence: number;
};

type ApiSession = {
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  speakers: ApiSpeaker[];
};

type ApiSponsor = {
  name: string | null;
  tier: string | null;
  description: string | null;
};

type ApiEvent = {
  id: string;
  title: string | null;
  source_url: string;
  starts_at: string | null;
  country: string | null;
  city: string | null;
  location: string | null;
  venue: string | null;
  description: string | null;
  confidence: number | null;
  confidence_reason?: string;
  sessions: ApiSession[];
  speakers: ApiSpeaker[];
  sponsors: ApiSponsor[];
  countrySource?: string | null;
  citySource?: string | null;
  locationSource?: string | null;
  relatedUrls?: string[];
  acceptedByCountryGate?: boolean;
};

type EnhancedSearchResult = {
  events?: unknown[];
  effectiveQ?: string;
  searchRetriedWithBase?: boolean;
  providersTried?: string[];
  logs?: Record<string, unknown>[];
};

function ensureString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function ensureNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function ensureBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return null;
}

function normalizeCountryCode(value: string | null): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  const aliases: Record<string, string> = {
    DE: 'DE', GERMANY: 'DE', DEUTSCHLAND: 'DE',
    AT: 'AT', AUSTRIA: 'AT', ÖSTERREICH: 'AT', OSTERREICH: 'AT',
    CH: 'CH', SWITZERLAND: 'CH', SCHWEIZ: 'CH', SCHWEIZERISCHE: 'CH',
    FR: 'FR', FRANCE: 'FR', FRANKREICH: 'FR',
    IT: 'IT', ITALY: 'IT', ITALIEN: 'IT',
    ES: 'ES', SPAIN: 'ES', SPANIEN: 'ES',
    NL: 'NL', NETHERLANDS: 'NL', NIEDERLANDE: 'NL', HOLLAND: 'NL',
    BE: 'BE', BELGIUM: 'BE', BELGIEN: 'BE'
  };
  return aliases[upper] ?? (upper.length === 2 ? upper : null);
}

function toApiSpeakers(raw: unknown): ApiSpeaker[] {
  console.log('toApiSpeakers called with:', { raw, isArray: Array.isArray(raw), length: Array.isArray(raw) ? raw.length : 'not array' });
  if (!Array.isArray(raw)) return [];
  const result = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const speaker = entry as Record<string, unknown>;
      const name = ensureString(speaker.name);
      const title = ensureString(speaker.title) ?? ensureString(speaker.role);
      const org = ensureString(speaker.organization) ?? ensureString(speaker.company);
      const bio = ensureString(speaker.bio);
      if (!name && !title && !org && !bio) return null;
      
      // Calculate confidence based on data completeness
      let confidence = 0.5; // Base confidence
      if (name) confidence += 0.2;
      if (title) confidence += 0.15;
      if (org) confidence += 0.15;
      if (bio) confidence += 0.1;
      
      return { name, title, org, bio: bio || null, confidence } satisfies ApiSpeaker;
    })
    .filter((speaker): speaker is ApiSpeaker => !!speaker);
  
  console.log('toApiSpeakers returning:', { result, length: result.length });
  return result;
}

function toApiSessions(raw: unknown): ApiSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const session = entry as Record<string, unknown>;
      const title = ensureString(session.title) ?? ensureString(session.name);
      const starts_at = ensureString(session.starts_at) ?? ensureString(session.startTime) ?? ensureString(session.date);
      const ends_at = ensureString(session.ends_at) ?? ensureString(session.endTime);
      const speakers = toApiSpeakers(session.speakers);
      if (!title && !starts_at && speakers.length === 0) return null;
      return { title, starts_at, ends_at, speakers } satisfies ApiSession;
    })
    .filter((session): session is ApiSession => !!session);
}

function toApiSponsors(raw: unknown): ApiSponsor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const sponsor = entry as Record<string, unknown>;
      const name = ensureString(sponsor.name);
      const tier = ensureString(sponsor.tier) ?? ensureString(sponsor.level);
      const description = ensureString(sponsor.description);
      if (!name && !tier && !description) return null;
      return { name, tier, description } satisfies ApiSponsor;
    })
    .filter((sponsor): sponsor is ApiSponsor => !!sponsor);
}

function toApiEvent(raw: unknown): ApiEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const details = obj.details && typeof obj.details === 'object' ? (obj.details as Record<string, unknown>) : undefined;
  const sourceUrl = ensureString(obj.source_url) ?? ensureString(obj.url) ?? ensureString(details?.source_url ?? details?.url);
  if (!sourceUrl) return null;

  // DEBUG: Log the raw event data to see what we're processing
  console.log('toApiEvent processing:', {
    title: obj.title,
    speakers: obj.speakers,
    speakersLength: Array.isArray(obj.speakers) ? obj.speakers.length : 'not array',
    speakersType: typeof obj.speakers,
    details: details ? { speakers: details.speakers } : 'no details'
  });

  const id = ensureString(obj.id) ?? ensureString(details?.id) ?? sourceUrl;
  const title = ensureString(obj.title) ?? ensureString(details?.title);
  const description = ensureString(obj.description) ?? ensureString(details?.description);
  const starts_at = ensureString(obj.starts_at) ?? ensureString(details?.starts_at);
  const country = normalizeCountryCode(ensureString(obj.country) ?? ensureString(details?.country));
  const city = ensureString(obj.city) ?? ensureString(details?.city);
  const location = ensureString(obj.location) ?? ensureString(details?.location);
  const venue = ensureString(obj.venue) ?? ensureString(details?.venue);
  const confidence = ensureNumber(obj.confidence);
  const confidence_reason = ensureString(obj.confidence_reason) || undefined;
  const countrySource = ensureString((obj as Record<string, unknown>).countrySource ?? (details?.countrySource as unknown));
  const citySource = ensureString((obj as Record<string, unknown>).citySource ?? (details?.citySource as unknown));
  const locationSource = ensureString((obj as Record<string, unknown>).locationSource ?? (details?.locationSource as unknown));
  const acceptedByCountryGate = ensureBoolean((obj as Record<string, unknown>).acceptedByCountryGate);
  const relatedUrlsRaw = (obj as Record<string, unknown>).relatedUrls ?? details?.relatedUrls;
  const relatedUrls = Array.isArray(relatedUrlsRaw)
    ? relatedUrlsRaw
        .map((item: unknown) => ensureString(item))
        .filter((u: string | null): u is string => !!u)
    : [];

  const sessions = toApiSessions(obj.sessions ?? details?.sessions ?? []);
  const speakers = toApiSpeakers(obj.speakers ?? details?.speakers ?? []);
  const sponsors = toApiSponsors(obj.sponsors ?? details?.sponsors ?? []);

  return {
    id,
    title,
    source_url: sourceUrl,
    starts_at,
        country,
    city,
    location,
    venue,
    description,
    confidence,
    confidence_reason,
    sessions,
    speakers,
    sponsors,
    countrySource,
    citySource,
    locationSource,
    relatedUrls,
    acceptedByCountryGate: acceptedByCountryGate ?? undefined
  };
}

// Helper function to process enhanced search results
const locationHintsCache: Record<string, string[]> = {};

function getCountryHints(countryCode: string | null, cfg: ActiveConfig): string[] {
  if (!countryCode) return [];
  const upper = countryCode.toUpperCase();
  const cacheKey = `${cfg.id ?? 'default'}:${upper}`;
  if (locationHintsCache[cacheKey]) return locationHintsCache[cacheKey];
  const locationTerms = cfg.locationTermsByCountry?.[upper] ?? [];
  const cityTerms = cfg.cityKeywordsByCountry?.[upper] ?? [];
  const manualAliases: Record<string, string[]> = {
    DE: ['germany', 'deutschland'],
    AT: ['austria', 'österreich', 'osterreich'],
    CH: ['switzerland', 'schweiz'],
    FR: ['france', 'frankreich'],
    IT: ['italy', 'italien'],
    ES: ['spain', 'spanien'],
    NL: ['netherlands', 'niederlande', 'holland'],
    BE: ['belgium', 'belgien']
  };
  const hints = Array.from(new Set([...locationTerms, ...cityTerms, upper, upper.toLowerCase(), ...(manualAliases[upper] ?? [])]))
    .map((term) => term.toLowerCase())
    .filter(Boolean);
  locationHintsCache[cacheKey] = hints;
  return hints;
}

function locationMentionsCountry(location: string | null, countryCode: string | null, cfg: ActiveConfig): boolean {
  if (!location || !countryCode) return false;
  const normalized = location.toLowerCase();
  const tokens = getCountryHints(countryCode, cfg);
  return tokens.some((token) => token && normalized.includes(token));
}

async function processEnhancedResults(res: EnhancedSearchResult, country: string | null, dateFrom: string | null, dateTo: string | null, includeDebug = false) {
  const events: ApiEvent[] = Array.isArray(res.events)
    ? res.events.map(toApiEvent).filter((event): event is ApiEvent => !!event)
    : [];

  const sortedEvents = [...events].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const euCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'MT', 'CY', 'IE', 'PT', 'GR'];
  const broadEuropeKeywords = ['europe', 'european union', 'eu-wide', 'eu'];
  const cfg = await loadActiveConfig();

  const filteredEvents = sortedEvents.filter((event: ApiEvent) => {
    const eventCountry = event.country ?? null;
    const target = country ? country.toUpperCase() : null;
    const eventUpper = eventCountry ? eventCountry.toUpperCase() : null;
    const textSources = [
      event.location ?? null,
      event.city ?? null,
      event.title ?? null,
      event.description ?? null,
      event.relatedUrls?.length ? event.relatedUrls.join(' ') : null
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    const mentionsCountry = target && target !== 'EU' && country
      ? textSources.some((hint) => locationMentionsCountry(hint, country, cfg))
      : false;
    const mentionsEurope = textSources
      .map((hint) => hint.toLowerCase())
      .some((hint) => broadEuropeKeywords.some((keyword) => hint.includes(keyword)));

    let countryMatch = true;
    if (target) {
      if (target === 'EU') {
        countryMatch = (eventUpper ? euCountries.includes(eventUpper) : false) || mentionsEurope || mentionsCountry;
      } else {
        if (eventUpper) {
          countryMatch = eventUpper === target || mentionsCountry;
        } else {
          countryMatch = mentionsCountry;
        }

        if (!countryMatch && euCountries.includes(target)) {
          countryMatch = mentionsEurope;
        }
      }
    }

    if (!countryMatch) {
      const acceptedByGuard = event.acceptedByCountryGate === true;
      const highConfidence = (event.confidence ?? 0) >= 0.75;
      if (acceptedByGuard) {
        if (!eventUpper || (target && eventUpper === target) || mentionsCountry || (target === 'EU' && mentionsEurope)) {
          countryMatch = true;
        }
      } else if (highConfidence && (mentionsCountry || (target === 'EU' && mentionsEurope))) {
        countryMatch = true;
      }
    }

    if (!countryMatch) {
      return false;
    }

    if (dateFrom && event.starts_at && event.starts_at < dateFrom) {
      return false;
    }
    if (dateTo && event.starts_at && event.starts_at > dateTo) {
      return false;
    }

    return true;
  });

  const response = {
    count: filteredEvents.length,
    saved: [],
    events: filteredEvents,
    marker: 'RUN_V4_ENHANCED',
    country,
    provider: 'enhanced_pipeline',
    searchConfig: { source: 'active', baseQueryUsed: true },
    effectiveQ: res.effectiveQ ?? '',
    searchRetriedWithBase: res.searchRetriedWithBase ?? false,
    search: { status: 200, provider: 'enhanced_pipeline', items: events.length, scored: true },
    urls: { unique: events.length, sample: events.slice(0, 10).map((event: ApiEvent) => ({ url: event.source_url, confidence: event.confidence ?? null })) },
    extract: {
      status: 200,
      version: 'enhanced_extraction',
      eventsBeforeFilter: events.length,
      sampleTrace: [],
      confidenceRange: events.length
        ? {
            max: Math.max(...events.map((event) => event.confidence ?? 0)),
            min: Math.min(...events.map((event) => event.confidence ?? 0))
          }
        : null
    },
    deduped: { count: events.length },
    dateFiltering: {
      from: dateFrom, to: dateTo, beforeCount: events.length, allowUndated: true, afterCount: filteredEvents.length
    },
    filter: {
      kept: filteredEvents.length,
      reasons: {
        kept: filteredEvents.length,
        wrongCountry: events.length - filteredEvents.length,
        ambiguous: 0
      }
    },
    upsert: { saved: 0 },
    providersTried: res.providersTried ?? ['enhanced_pipeline'],
    logs: res.logs ?? [],
    scoring: {
      model: (res.logs ?? []).find((log) => log.at === 'prioritization')?.modelPath ?? null,
      rejected: (res.logs ?? []).find((log) => log.at === 'extraction')?.rejected ?? []
    },
  };

  if (includeDebug) {
    return {
      ...response,
      debug: res
    };
  }

  return response;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userText: string = url.searchParams.get('userText') ?? 'legal conference 2025';
    const country: string | null = url.searchParams.get('country') ?? 'DE';
    const dateFrom: string | null = url.searchParams.get('dateFrom');
    const dateTo: string | null = url.searchParams.get('dateTo');
    const locale: 'de' | 'en' = (url.searchParams.get('locale') === 'en' ? 'en' : 'de');
    const location: string | null = url.searchParams.get('location');
    const timeframe: string | null = url.searchParams.get('timeframe');
    const includeDebug = url.searchParams.get('debug') === '1';

    const res = await executeEnhancedSearch({ 
      userText, 
      country,
      dateFrom, 
      dateTo, 
      locale, 
      location, 
      timeframe 
    });
    const result = await processEnhancedResults(res, country, dateFrom, dateTo, includeDebug);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'search_failed';
    return NextResponse.json({ error: message, debug: { crashed: true } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userText: string = body?.userText ?? '';   // <- canonical
    const country: string | null = body?.country ?? 'DE';
    const dateFrom: string | null = body?.dateFrom ?? null;
    const dateTo: string | null = body?.dateTo ?? null;
    const locale: 'de' | 'en' = (body?.locale === 'en' ? 'en' : 'de');
    const location: string | null = body?.location ?? null;
    const timeframe: string | null = body?.timeframe ?? null;
    const includeDebug = body?.debug === true;

    console.log('[api/events/run] Starting search with params:', {
      userText,
      country,
      dateFrom,
      dateTo,
      locale,
      location,
      timeframe
    });

    const res = await executeEnhancedSearch({ 
      userText, 
      country,
      dateFrom, 
      dateTo, 
      locale, 
      location, 
      timeframe 
    });
    
    console.log('[api/events/run] Search completed, processing results...');
    const result = await processEnhancedResults(res, country, dateFrom, dateTo, includeDebug);

    if ((!result.events || result.events.length === 0) && demoFallbackEnabled()) {
      console.log('[api/events/run] No events found, using demo fallback');
      const demoEvents = buildDemoFallback(country);
      return NextResponse.json({
        ...result,
        provider: 'demo_fallback',
        events: demoEvents,
        count: demoEvents.length,
        note: 'demo_fallback_active'
      });
    }

    console.log('[api/events/run] Returning results:', {
      eventCount: result.events?.length || 0,
      provider: result.provider
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/events/run] Error occurred:', error);
    const message = error instanceof Error ? error.message : 'search_failed';
    const errorResponse = { 
      error: message, 
      debug: { 
        crashed: true,
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      } 
    };
    
    // Ensure we always return valid JSON
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}