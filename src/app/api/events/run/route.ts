// app/api/events/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { executeEnhancedSearch } from '@/common/search/enhanced-orchestrator';

type ApiSpeaker = {
  name: string | null;
  title: string | null;
  organization: string | null;
  bio?: string | null;
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

function toApiSpeakers(raw: unknown): ApiSpeaker[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const speaker = entry as Record<string, unknown>;
      const name = ensureString(speaker.name);
      const title = ensureString(speaker.title) ?? ensureString(speaker.role);
      const organization = ensureString(speaker.organization) ?? ensureString(speaker.company);
      const bio = ensureString(speaker.bio);
      if (!name && !title && !organization && !bio) return null;
      return { name, title, organization, bio } satisfies ApiSpeaker;
    })
    .filter((speaker): speaker is ApiSpeaker => !!speaker);
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

  const id = ensureString(obj.id) ?? ensureString(details?.id) ?? sourceUrl;
  const title = ensureString(obj.title) ?? ensureString(details?.title);
  const description = ensureString(obj.description) ?? ensureString(details?.description);
  const starts_at = ensureString(obj.starts_at) ?? ensureString(details?.starts_at);
  const country = ensureString(obj.country) ?? ensureString(details?.country);
  const city = ensureString(obj.city) ?? ensureString(details?.city);
  const location = ensureString(obj.location) ?? ensureString(details?.location);
  const venue = ensureString(obj.venue) ?? ensureString(details?.venue);
  const confidence = ensureNumber(obj.confidence);
  const confidence_reason = ensureString(obj.confidence_reason);

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
    sponsors
  };
}

// Helper function to process enhanced search results
function locationMentionsCountry(location: string | null, countryCode: string | null): boolean {
  if (!location || !countryCode) return false;
  const normalized = location.toLowerCase();
  const code = countryCode.toLowerCase();
  const hints: Record<string, string[]> = {
    de: ['germany', 'deutschland', 'berlin', 'frankfurt', 'munich', 'münchen', 'hamburg', 'stuttgart', 'köln', 'cologne']
  };
  const tokens = hints[code] ?? [code];
  return tokens.some((token) => normalized.includes(token));
}

function processEnhancedResults(res: EnhancedSearchResult, country: string | null, dateFrom: string | null, dateTo: string | null, includeDebug = false) {
  const events: ApiEvent[] = Array.isArray(res.events)
    ? res.events.map(toApiEvent).filter((event): event is ApiEvent => !!event)
    : [];

  // Sort by confidence desc if available
  const sortedEvents = [...events].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  
  // EU country codes for broader filtering
  const euCountries = ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'MT', 'CY', 'IE', 'PT', 'GR'];
  
  // Simple filtering based on country and date
const filteredEvents = sortedEvents.filter((event: ApiEvent) => {
    const eventCountry = event.country ?? null;

    const countryMatch = (() => {
      if (!country) return true;
    const target = country.toUpperCase();
    if (!eventCountry) {
      // If we don't know the country, keep the event unless we require a specific non-EU country.
      // For EU, any European event is acceptable; otherwise rely on location hints.
      if (target === 'EU') return true;
      return locationMentionsCountry(event.location ?? null, country);
    }
    const eventUpper = eventCountry.toUpperCase();
    if (target === 'EU') {
      return euCountries.includes(eventUpper);
    }
    return eventUpper === target;
    })();

    if (!countryMatch) {
      return false;
    }

    // Date filtering (if dates provided)
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
    const result = processEnhancedResults(res, country, dateFrom, dateTo, includeDebug);
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

    const res = await executeEnhancedSearch({ 
      userText, 
        country,
      dateFrom, 
      dateTo, 
      locale, 
      location, 
      timeframe 
    });
    const result = processEnhancedResults(res, country, dateFrom, dateTo, includeDebug);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'search_failed';
    return NextResponse.json({ error: message, debug: { crashed: true } }, { status: 500 });
  }
}