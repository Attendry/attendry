import * as cheerio from 'cheerio';

function normalizeSession(raw: unknown): ExtractedSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const title = getString(obj.title) ?? getString(obj.name);
  const description = getString(obj.description) ?? null;
  const starts_at = normalizeDateInput(getString(obj.starts_at) ?? getString(obj.startTime) ?? getString(obj.date) ?? null);
  const ends_at = normalizeDateInput(getString(obj.ends_at) ?? getString(obj.endTime) ?? null);
  const speakers = Array.isArray(obj.speakers)
    ? obj.speakers.map((s) => typeof s === 'string' ? s : getString((s as Record<string, unknown>)?.name)).filter((s): s is string => !!s)
    : [];

  if (!title && !description && !starts_at && speakers.length === 0) return null;
  return { title, description, starts_at, ends_at, speakers };
}

function normalizeSpeaker(raw: unknown): ExtractedSpeaker | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name = getString(obj.name);
  const title = getString(obj.title) ?? getString(obj.role);
  const organization = getString(obj.organization) ?? getString(obj.company);
  const bio = getString(obj.bio) ?? null;
  const sessions = Array.isArray(obj.sessions)
    ? obj.sessions.map((s) => typeof s === 'string' ? s : getString((s as Record<string, unknown>)?.title)).filter((s): s is string => !!s)
    : [];

  if (!name && !organization && !title && !bio) return null;
  return { name, title, organization, bio, sessions };
}

function normalizeSponsor(raw: unknown): ExtractedSponsor | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name = getString(obj.name);
  const tier = getString(obj.tier) ?? getString(obj.level);
  const description = getString(obj.description) ?? null;

  if (!name && !description) return null;
  return { name, tier, description };
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}
// Enhanced orchestrator with full pipeline: Search → Prioritization → Extract
import { loadActiveConfig, type ActiveConfig } from './config';
import { tryJsonRepair } from '../utils/json';
import { buildSearchQuery } from './queryBuilder';
import { search as firecrawlSearch } from '../../providers/firecrawl';
import { search as cseSearch } from '../../providers/cse';
import { search as databaseSearch } from '../../providers/database';
import { fetchCachedExtraction, upsertCachedExtraction } from './cache';

type ExecArgs = {
  userText?: string;
  country?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  locale?: 'de' | 'en';
  location?: string | null; // 'EU' or specific country codes
  timeframe?: string | null; // 'next_7', 'next_14', 'next_30', 'past_7', 'past_14', 'past_30'
};

type TimeframeContext = {
  dateFrom: string | null;
  dateTo: string | null;
  tokens: string[];
  label: string | null;
  kind: 'next' | 'past' | null;
  days: number | null;
};

type LocationContext = {
  countries: string[];
  primary: string;
  tokens: string[];
  label: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function processTimeframe(timeframe: string | null): TimeframeContext {
  if (!timeframe) {
    return { dateFrom: null, dateTo: null, tokens: [], label: null, kind: null, days: null };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windows: Record<string, { direction: 'next' | 'past'; days: number }> = {
    next_7: { direction: 'next', days: 7 },
    next_14: { direction: 'next', days: 14 },
    next_30: { direction: 'next', days: 30 },
    past_7: { direction: 'past', days: 7 },
    past_14: { direction: 'past', days: 14 },
    past_30: { direction: 'past', days: 30 }
  };

  const win = windows[timeframe];
  if (!win) {
    return { dateFrom: null, dateTo: null, tokens: [], label: null, kind: null, days: null };
  }

  const { direction, days } = win;
  const offset = days * MS_PER_DAY;
  const rangeStart = direction === 'next' ? today : new Date(today.getTime() - offset);
  const rangeEnd = direction === 'next' ? new Date(today.getTime() + offset) : today;

  const dateFrom = rangeStart.toISOString().split('T')[0];
  const dateTo = rangeEnd.toISOString().split('T')[0];

  const tokens = buildTimeframeTokens(rangeStart, rangeEnd, direction, days);
  const label = direction === 'next' ? `next ${days} days` : `past ${days} days`;

  return {
    dateFrom,
    dateTo,
    tokens,
    label,
    kind: direction,
    days
  };
}

function buildTimeframeTokens(rangeStart: Date, rangeEnd: Date, direction: 'next' | 'past', days: number): string[] {
  const tokens = new Set<string>();
  const startISO = rangeStart.toISOString().split('T')[0];
  const endISO = rangeEnd.toISOString().split('T')[0];
  tokens.add(startISO);
  tokens.add(endISO);
  tokens.add(formatDotDate(rangeStart));
  tokens.add(formatDotDate(rangeEnd));

  const monthFormatterDe = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
  const monthFormatterEn = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  tokens.add(monthFormatterDe.format(rangeStart));
  tokens.add(monthFormatterDe.format(rangeEnd));
  tokens.add(monthFormatterEn.format(rangeStart));
  tokens.add(monthFormatterEn.format(rangeEnd));

  if (direction === 'next') {
    tokens.add(`kommenden ${days} Tagen`);
    tokens.add(`nächsten ${days} Tage`);
    tokens.add(`next ${days} days`);
    tokens.add('upcoming');
  } else {
    tokens.add(`letzten ${days} Tage`);
    tokens.add(`vergangenen ${days} Tagen`);
    tokens.add(`past ${days} days`);
    tokens.add('recent');
  }

  tokens.add(`${rangeStart.getFullYear()}`);
  if (rangeStart.getFullYear() !== rangeEnd.getFullYear()) {
    tokens.add(`${rangeEnd.getFullYear()}`);
  }

  return Array.from(tokens).filter(Boolean).slice(0, 10);
}

function formatDotDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function quoteToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (/^".*"$/.test(trimmed)) return trimmed;
  if (/\s/.test(trimmed)) return `"${trimmed}"`;
  return trimmed;
}

function buildEventFocusedQuery(
  baseQuery: string,
  userText: string,
  locationContext: LocationContext,
  timeframeContext: TimeframeContext,
  searchConfig: ActiveConfig
): string {
  const eventTerms = Array.isArray(searchConfig.eventTerms) && searchConfig.eventTerms.length
    ? searchConfig.eventTerms
    : ['conference', 'event', 'summit', 'workshop', 'seminar', 'meeting', 'symposium', 'forum', 'exhibition', '"trade show"', '"trade fair"', 'convention', 'congress'];
  const eventQuery = `(${eventTerms.join(' OR ')})`;

  const segments = [baseQuery, eventQuery];

  if (locationContext.tokens.length) {
    const locTokens = locationContext.tokens.map(quoteToken).filter(Boolean);
    if (locTokens.length) {
      segments.push(`(${locTokens.join(' OR ')})`);
    }
  }

  if (timeframeContext.tokens.length) {
    const timeTokens = timeframeContext.tokens.map(quoteToken).filter(Boolean);
    if (timeTokens.length) {
      segments.push(`(${timeTokens.join(' OR ')})`);
    }
  }

  return segments.join(' ').replace(/\s+/g, ' ').trim();
}

type PrioritizedUrl = {
  url: string;
  score: number;
  reason?: string;
};

type PrioritizationResult = {
  items: PrioritizedUrl[];
  modelPath: string | null;
  fallbackReason?: string;
};

type CountryGuardDecision = {
  url: string;
  status: 'keep' | 'drop';
  reason?: string;
  confidence?: number;
};

type ScoredEvent = {
  id: string;
  title: string | null;
  source_url: string;
  starts_at: string | null;
  country: string | null;
  city: string | null;
  location: string | null;
  venue: string | null;
  description: string | null;
  speakers: unknown[];
  confidence: number;
  confidence_reason?: string;
  scoringTrace?: {
    geminiScore?: number;
    heuristicScore?: number;
  };
};

type ExtractedSession = {
  title: string | null;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  speakers: string[];
};

type ExtractedSpeaker = {
  name: string | null;
  title: string | null;
  organization: string | null;
  bio: string | null;
  sessions?: string[];
};

type ExtractedSponsor = {
  name: string | null;
  tier: string | null;
  description: string | null;
};

type ExtractedEventDetails = {
  title: string | null;
  description: string | null;
  starts_at: string | null;
  country: string | null;
  city: string | null;
  location: string | null;
  venue: string | null;
  sessions: ExtractedSession[];
  speakers: ExtractedSpeaker[];
  sponsors: ExtractedSponsor[];
  relatedUrls: string[];
  countrySource?: string | null;
  citySource?: string | null;
  locationSource?: string | null;
  debugVisitedLinks?: string[];
};

async function classifyUrlsForCountry(
  urls: string[],
  searchConfig: ActiveConfig,
  targetCountry: string | null
): Promise<{ keep: string[]; drop: string[]; decisions: CountryGuardDecision[] }> {
  if (!targetCountry || !urls.length) {
    const allKeep = urls.map((url) => ({ url, status: 'keep' as const, reason: 'no_target_country', confidence: 0.1 }));
    return { keep: urls, drop: [], decisions: allKeep };
  }

  const normalizedTarget = targetCountry.toUpperCase();
  const keep: string[] = [];
  const drop: string[] = [];
  const decisions: CountryGuardDecision[] = [];

  const locationTokens = searchConfig.locationTermsByCountry?.[normalizedTarget] ?? [];
  const cityTokens = searchConfig.cityKeywordsByCountry?.[normalizedTarget] ?? [];
  const normalizedTokens = Array.from(new Set([...locationTokens, ...cityTokens])).map((token) => token.toLowerCase());

  for (const url of urls) {
    const normalizedUrl = url.toLowerCase();
    const matchesToken = normalizedTokens.some((token) => normalizedUrl.includes(token));
    const matchesTld = normalizedUrl.includes(`.${normalizedTarget.toLowerCase()}`);

    if (matchesToken || matchesTld) {
      keep.push(url);
      decisions.push({
        url,
        status: 'keep',
        reason: matchesToken ? 'country_token_match' : 'country_tld_match',
        confidence: matchesToken ? 0.7 : 0.6
      });
    } else {
      // Do not drop aggressively here; let prioritization/extraction decide.
      keep.push(url);
      decisions.push({ url, status: 'keep', reason: 'no_country_signal_soft_keep', confidence: 0.2 });
    }
  }

  if (keep.length === 0) {
    return { keep: urls, drop: [], decisions: urls.map((url) => ({ url, status: 'keep', reason: 'fallback_keep_all', confidence: 0.1 })) };
  }

  return { keep, drop, decisions };
}

function normalizeDateInput(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const germanMatch = value.match(/^(\d{1,2})[.](\d{1,2})[.](\d{4})$/);
  if (germanMatch) {
    const [, d, m, y] = germanMatch;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    if (year >= 2020 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    const day = parseInt(d, 10);
    const month = parseInt(m, 10);
    const year = parseInt(y, 10);
    if (year >= 2020 && year <= 2035 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.valueOf())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
}

type ExtractResponse = Record<string, unknown>;

function extractCandidatePayload(raw: ExtractResponse | null | undefined, url: string): unknown {
  if (!raw) return null;

  if (raw.json) {
    logExtractionDebug(url, 'firecrawl_payload_json', {});
    return raw.json;
  }

  const outputs = Array.isArray(raw.outputs) ? raw.outputs : [];
  for (const [index, entry] of outputs.entries()) {
    if (!entry || typeof entry !== 'object') continue;
    const typed = entry as Record<string, unknown>;
    if (typed.json) {
      logExtractionDebug(url, 'firecrawl_payload_outputs_json', { index });
      return typed.json;
    }
    if (typed.output && typeof typed.output === 'object') {
      const output = typed.output as Record<string, unknown>;
      if (typeof output.json === 'object') {
        logExtractionDebug(url, 'firecrawl_payload_output_json', { index });
        return output.json;
      }
      if (typeof output.text === 'string') {
        logExtractionDebug(url, 'firecrawl_payload_output_text', { index });
        return output.text;
      }
      if (typeof output.markdown === 'string') {
        logExtractionDebug(url, 'firecrawl_payload_output_markdown', { index });
        return output.markdown;
      }
    }
    if (typed.content && typeof typed.content === 'object') {
      const content = typed.content as Record<string, unknown>;
      if (typeof content.json === 'object') {
        logExtractionDebug(url, 'firecrawl_payload_content_json', { index });
        return content.json;
      }
      if (typeof content.text === 'string') {
        logExtractionDebug(url, 'firecrawl_payload_content_text', { index });
        return content.text;
      }
      if (typeof content.markdown === 'string') {
        logExtractionDebug(url, 'firecrawl_payload_content_markdown', { index });
        return content.markdown;
      }
    }
  }

  if (raw.text && typeof raw.text === 'string') {
    logExtractionDebug(url, 'firecrawl_payload_text', {});
    return raw.text;
  }

  return raw;
}

function toExtractedEventDetails(source: unknown): ExtractedEventDetails {
  if (!source) {
    return emptyExtractedDetails();
  }

  let obj: Record<string, unknown> = {};
  if (typeof source === 'string') {
    try {
      obj = JSON.parse(source) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (typeof source === 'object') {
    obj = source as Record<string, unknown>;
  }

  const title = typeof obj.title === 'string' && obj.title.trim().length ? obj.title.trim() : null;
  const description = typeof obj.description === 'string' && obj.description.trim().length ? obj.description.trim() : null;
  const startsAt = normalizeDateInput((obj.starts_at || obj.startDate || obj.date || obj.start_date || obj.start) as string | undefined);
  const country = typeof obj.country === 'string' && obj.country.trim().length ? obj.country.trim().toUpperCase() : (typeof obj.countryCode === 'string' ? obj.countryCode.trim().toUpperCase() : null);
  const city = typeof obj.city === 'string' && obj.city.trim().length ? obj.city.trim() : null;
  const location = typeof obj.location === 'string' && obj.location.trim().length ? obj.location.trim() : null;
  const venue = typeof obj.venue === 'string' && obj.venue.trim().length ? obj.venue.trim() : null;

  const sessions = Array.isArray(obj.sessions) ? obj.sessions.map(normalizeSession).filter(Boolean) as ExtractedSession[] : [];
  const speakers = Array.isArray(obj.speakers) ? obj.speakers.map(normalizeSpeaker).filter(Boolean) as ExtractedSpeaker[] : [];
  const sponsors = Array.isArray(obj.sponsors) ? obj.sponsors.map(normalizeSponsor).filter(Boolean) as ExtractedSponsor[] : [];
  const relatedUrls = Array.isArray(obj.relatedUrls)
    ? (obj.relatedUrls as unknown[]).map((entry) => typeof entry === 'string' ? entry : null).filter((entry): entry is string => !!entry)
    : [];

  return {
    title,
    description,
    starts_at: startsAt,
    country,
    city,
    location,
    venue,
    sessions,
    speakers,
    sponsors,
    relatedUrls
  };
}

function mergeDetails(primary: ExtractedEventDetails, fallback: ExtractedEventDetails): ExtractedEventDetails {
  return {
    title: primary.title ?? fallback.title ?? null,
    description: primary.description ?? fallback.description ?? null,
    starts_at: primary.starts_at ?? fallback.starts_at ?? null,
    country: primary.country ?? fallback.country ?? null,
    countrySource: primary.country ? primary.countrySource ?? 'primary' : fallback.country ? fallback.countrySource ?? 'fallback' : null,
    city: primary.city ?? fallback.city ?? null,
    citySource: primary.city ? primary.citySource ?? 'primary' : fallback.city ? fallback.citySource ?? 'fallback' : null,
    location: primary.location ?? fallback.location ?? null,
    locationSource: primary.location ? primary.locationSource ?? 'primary' : fallback.location ? fallback.locationSource ?? 'fallback' : null,
    venue: primary.venue ?? fallback.venue ?? null,
    sessions: mergeArray(primary.sessions, fallback.sessions, (session) => session.title ?? session.description ?? JSON.stringify(session)),
    speakers: mergeArray(primary.speakers, fallback.speakers, (speaker) => speaker.name ?? JSON.stringify(speaker)),
    sponsors: mergeArray(primary.sponsors, fallback.sponsors, (sponsor) => sponsor.name ?? JSON.stringify(sponsor)),
    relatedUrls: mergeArray(primary.relatedUrls, fallback.relatedUrls),
    debugVisitedLinks: mergeArray(primary.debugVisitedLinks ?? [], fallback.debugVisitedLinks ?? [])
  };
}

function mergeArray<T>(primary: T[] | null | undefined, fallback: T[] | null | undefined, keyFn?: (item: T) => string): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  const key = (item: T, index: number) => keyFn ? keyFn(item) ?? `${index}` : JSON.stringify(item);

  for (const list of [primary ?? [], fallback ?? []]) {
    list.forEach((item, index) => {
      const k = key(item, index);
      if (!seen.has(k)) {
        seen.add(k);
        result.push(item);
      }
    });
  }

  return result;
}

function formatLocation(city?: string | null, country?: string | null): string | null {
  const trimmedCity = city?.trim();
  const trimmedCountry = country?.trim();
  if (trimmedCity && trimmedCountry) {
    return `${trimmedCity}, ${trimmedCountry}`;
  }
  return trimmedCity ?? trimmedCountry ?? null;
}

function includesToken(haystack: string | null | undefined, tokens: string[]): boolean {
  if (!haystack) return false;
  const lowerHaystack = haystack.toLowerCase();
  return tokens.some((token) => {
    const normalized = token.toLowerCase();
    const hyphenated = normalized.replace(/\s+/g, '-');
    return lowerHaystack.includes(normalized) || lowerHaystack.includes(hyphenated);
  });
}

function extractJsonPayload(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([^]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return raw.trim();
}

// Industry-agnostic Gemini prioritization
function normalizeTargetCountries(location: string | null, config: ActiveConfig): string[] {
  if (location && location.trim().length) {
    const normalized = location.trim().toUpperCase();

    if (normalized === 'EU') {
      if (config.euCountries?.length) {
        return config.euCountries.map((code) => code.toUpperCase());
      }
      return ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'MT', 'CY', 'IE', 'PT', 'GR'];
    }

    return [normalized];
  }

  if (config.defaultCountries?.length) {
    return config.defaultCountries.map((code) => code.toUpperCase());
  }

  return ['DE'];
}

async function prioritizeUrls(urls: string[], searchConfig: ActiveConfig, country: string, location: string | null, timeframe: string | null): Promise<PrioritizationResult> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[prioritization] No GEMINI_API_KEY, returning all URLs');
      return {
        items: urls.map((url, idx) => ({ url, score: 0.4 - idx * 0.01 })),
        modelPath: null,
        fallbackReason: 'api_key_missing'
      };
    }

    const targetCountries = normalizeTargetCountries(location, searchConfig);
    const primaryCountry = targetCountries[0] ?? 'DE';
    const locationContext = targetCountries.length === 1
      ? `in ${primaryCountry}`
      : `in ${targetCountries.slice(0, 5).join(', ')} countries`;

    const timeframeLabel = timeframe
      ? `within the ${timeframe.replace('_', ' ')} timeframe`
      : 'within the specified timeframe';

    // Build context from search config
    const industry = searchConfig.industry || 'general';
    const baseQuery = searchConfig.baseQuery || '';
    const excludeTerms = searchConfig.excludeTerms || '';
    
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

    const modelPath = process.env.GEMINI_MODEL_PATH
      || 'v1beta/models/gemini-2.5-flash:generateContent';
    const response = await fetch(`https://generativelanguage.googleapis.com/${modelPath}?key=${apiKey}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    let content: string | null = null;

    const rawText = await response.text();
    console.debug('[prioritization] Gemini raw response prefix', rawText.slice(0, 80));
    if (!response.ok) {
      console.warn('[prioritization] Gemini API failed', {
        status: response.status,
        statusText: response.statusText,
        body: rawText.slice(0, 500),
        modelPath,
      });
      console.warn('[prioritization] API Key length:', apiKey?.length || 0);
      console.warn('[prioritization] API Key starts with:', apiKey?.substring(0, 10) || 'N/A');
    } else {
      try {
        const repaired = await tryJsonRepair(rawText);
        if (repaired) {
          console.debug('[prioritization] Applied jsonrepair to Gemini response');
        }
        const data = JSON.parse(repaired ?? rawText) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string; functionCall?: { args?: Record<string, unknown> } }> } }>;
        };
        content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
        if (!content) {
          const firstCandidate = data.candidates?.[0];
          const parts = firstCandidate?.content?.parts ?? [];
          const maybeFunctionCallPart = parts.find((part) => {
            if (!part || typeof part !== 'object') return false;
            return 'functionCall' in part && typeof part.functionCall === 'object';
          });
          const maybeFunctionCall = (maybeFunctionCallPart as { functionCall?: { args?: Record<string, unknown> } } | undefined)?.functionCall;
          if (maybeFunctionCall?.args && Array.isArray(maybeFunctionCall.args.prioritizedUrls)) {
            content = JSON.stringify(maybeFunctionCall.args.prioritizedUrls);
          }
          if (!content && maybeFunctionCall?.args?.urls && Array.isArray(maybeFunctionCall.args.urls)) {
            content = JSON.stringify(maybeFunctionCall.args.urls);
          }
        }
      } catch (err) {
        console.warn('[prioritization] Failed to parse Gemini response JSON', err);
      }
    }
    
    if (!content) {
      console.warn('[prioritization] No content in Gemini response');
    const defaultScore = 0.3;
    return {
      items: urls.slice(0, 10).map((url, idx) => ({
        url,
        score: Math.max(defaultScore - idx * 0.02, 0),
        reason: response.ok ? 'empty_response' : 'no_content'
      })),
      modelPath,
      fallbackReason: response.ok ? 'empty_response' : 'no_content'
    };
    }

    try {
      const sanitized = extractJsonPayload(content);
      const prioritized = JSON.parse(sanitized) as GeminiPrioritizedItem[];
      if (Array.isArray(prioritized)) {
        const normalized = prioritized
          .map((item, idx): PrioritizedUrl | null => {
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
          .filter((item: PrioritizedUrl | null): item is PrioritizedUrl => !!item)
          .filter(item => urls.includes(item.url));

        if (normalized.length) {
          console.log('[prioritization] Successfully prioritized', normalized.length, 'URLs via Gemini');
          return { items: normalized, modelPath };
        }
      }
    } catch (parseError) {
      console.warn('[prioritization] Failed to parse Gemini response:', parseError);
      return {
        items: urls.slice(0, 10).map((url, idx) => ({
          url,
          score: 0.3 - idx * 0.02,
          reason: 'parse_failure'
        })),
        modelPath,
        fallbackReason: 'parse_failure',
        rawResponse: rawText.slice(0, 400)
      };
    }

    return {
      items: urls.slice(0, 10).map((url, idx) => ({
        url,
        score: 0.3 - idx * 0.02,
        reason: 'parse_failure'
      })),
      modelPath,
      fallbackReason: 'parse_failure'
    };
  } catch (error) {
    console.error('[prioritization] Error:', error);
    console.warn('[prioritization] Falling back to simple URL prioritization');
    
    // Simple fallback prioritization based on URL patterns
    const prioritized = urls
      .map((url, idx) => {
        const urlLower = url.toLowerCase();
        let score = 0.2 - idx * 0.01;
        if (urlLower.includes('.de')) score += 0.4;
        if (urlLower.includes('germany') || urlLower.includes('deutschland')) score += 0.3;
        if (urlLower.includes('event') || urlLower.includes('conference') || urlLower.includes('summit')) score += 0.2;
        return { url, score: Math.min(Math.max(score, 0), 1) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    if (prioritized.length > 0) {
      return {
        items: prioritized.map(item => ({ ...item, reason: 'fallback_heuristic' })),
        modelPath: null,
        fallbackReason: 'error'
      };
    }

    return {
      items: urls.slice(0, 10).map((url, idx) => ({ url, score: 0.1 - idx * 0.01, reason: 'fallback_default' })),
      modelPath: null,
      fallbackReason: 'error'
    };
  }
}

function generateExtractionPrompt(searchConfig: ActiveConfig): string {
  const allowedCountries = searchConfig.defaultCountries?.length
    ? searchConfig.defaultCountries.join(', ')
    : 'the target region';
  const eventTerms = searchConfig.eventTerms?.join(', ') ?? 'events, conferences, summits';

  return `Extract structured details for ${searchConfig.industry ?? 'general'} events.
Return strict JSON with the following shape:
{
  "title": string | null,
  "description": string | null,
  "starts_at": string | null,
  "country": string | null,
  "city": string | null,
  "location": string | null,
  "venue": string | null,
  "sessions": [
    {
      "title": string | null,
      "description": string | null,
      "starts_at": string | null,
      "ends_at": string | null,
      "speakers": string[]
    }
  ],
  "speakers": [
    {
      "name": string | null,
      "title": string | null,
      "organization": string | null,
      "bio": string | null,
      "sessions": string[]
    }
  ],
  "sponsors": [
    {
      "name": string | null,
      "tier": string | null,
      "description": string | null
    }
  ],
  "relatedUrls": string[]
}

Instructions:
- Identify if the page is about an actual ${eventTerms} and gather event-level info.
- Derive "starts_at" in ISO (YYYY-MM-DD) when possible; otherwise null.
- Use country ISO-2 code when identifiable; prefer ${allowedCountries}.
- Extract sessions with titles, timing, and speaker names when available.
- Extract speaker details (name, role, organization, bio snippets) linked to sessions if possible.
- Extract sponsors or partners with tier/description when present.
- Collect any in-domain links pointing to agenda, program, speakers, sponsors, or practical information pages in "relatedUrls".
- Do not invent data; use null or empty arrays when uncertain.
- Trim whitespace from all strings.`;
}

async function extractEventDetails(url: string, searchConfig: ActiveConfig): Promise<ExtractedEventDetails> {
  const apiKey = getFirecrawlApiKey();
  if (!apiKey) {
    console.warn('[extract] No Firecrawl API key available');
  }

  // Step 1: Cheap HTML fetch (avoids credits and captures basic info)
  const basic = await cheapHtmlScrape(url, searchConfig).catch(err => {
    console.warn('[extract] Cheap HTML scrape failed', { url, err });
    return null;
  });

  let firecrawlResult: ExtractedEventDetails | null = null;
  if (apiKey) {
    firecrawlResult = await extractWithFirecrawl(url, apiKey, searchConfig).catch(err => {
      console.warn('[extract] Firecrawl extraction ultimately failed', { url, err });
      return null;
    });
  }

  // Step 3: Markdown fallback via Firecrawl if JSON extraction missing key fields
  if (apiKey && (!firecrawlResult || isExtractEmpty(firecrawlResult))) {
    firecrawlResult = await fallbackExtraction(url, apiKey, searchConfig).catch(err => {
      console.warn('[extract] Firecrawl fallback extraction failed', { url, err });
      return null;
    });
  }

  const merged = mergeDetails(basic ?? emptyExtractedDetails(), firecrawlResult ?? emptyExtractedDetails());
  const normalizedLocation = merged.location ?? formatLocation(merged.city, merged.country);

  if (merged.title || merged.description || merged.starts_at || merged.country || merged.city) {
    await upsertCachedExtraction({
      url,
      eventDate: merged.starts_at,
      country: merged.country,
      city: merged.city,
      payload: {
        ...merged,
        location: normalizedLocation ?? merged.location ?? null,
        locationSource: merged.locationSource,
        countrySource: merged.countrySource,
        citySource: merged.citySource,
        sessions: merged.sessions,
        speakers: merged.speakers,
        sponsors: merged.sponsors,
        relatedUrls: merged.relatedUrls,
        debugVisitedLinks: merged.debugVisitedLinks
      }
    });
  }

  const discoveredLinks = merged.relatedUrls.length > 0
    ? merged.relatedUrls
    : await discoverRelatedLinks(url, merged.relatedUrls);

  const enrichment = await extractEnrichmentFromLinks(url, discoveredLinks, apiKey, searchConfig);
  const enrichedMerged = mergeDetails(merged, enrichment);

  const result = {
    ...enrichedMerged,
    location: normalizedLocation ?? enrichedMerged.location ?? null,
    relatedUrls: discoveredLinks
  };
  return {
    ...result,
    debugVisitedLinks: mergeArray(result.debugVisitedLinks ?? [], merged.debugVisitedLinks ?? [], (value) => value)
  };
}

function emptyExtractedDetails(): ExtractedEventDetails {
  return {
    title: null,
    description: null,
    starts_at: null,
    country: null,
    city: null,
    location: null,
    venue: null,
    sessions: [],
    speakers: [],
    sponsors: [],
    relatedUrls: [],
    debugVisitedLinks: []
  };
}

function isExtractEmpty(value: ExtractedEventDetails | null | undefined): boolean {
  if (!value) return true;
  const coreEmpty = !value.title && !value.description && !value.starts_at && !value.country && !value.city && !value.location && !value.venue;
  const enrichmentEmpty = (!value.sessions || value.sessions.length === 0)
    && (!value.speakers || value.speakers.length === 0)
    && (!value.sponsors || value.sponsors.length === 0);
  return coreEmpty && enrichmentEmpty;
}

function logExtractionDebug(url: string, stage: string, data: Record<string, unknown>): void {
  const payload = { url, ...data };
  console.debug(`[extract_debug] ${stage}`, payload);
}

const HTML_FETCH_TIMEOUT = 5000;

const FIRECRAWL_SCRAPE_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape';
const FIRECRAWL_RETRY_DELAYS = [0, 1000, 2500];

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 AttendryBot/1.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
  'Cache-Control': 'no-cache'
};

async function cheapHtmlScrape(url: string, searchConfig: ActiveConfig): Promise<ExtractedEventDetails> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTML_FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    if (!html || !html.trim()) {
      console.warn('[extract] cheapHtmlScrape received empty body', { url });
      return emptyExtractedDetails();
    }
    const $ = cheerio.load(html);

    logExtractionDebug(url, 'cheap_html_dom', {
      hasH1: $('h1').length > 0,
      hasLdJson: $('script[type="application/ld+json"]').length > 0,
      titleSample: $('title').first().text().slice(0, 120)
    });

    const title = $('meta[property="og:title"]').attr('content')
      || $('title').first().text()
      || $('h1').first().text()
      || null;

    const description = $('meta[name="description"]').attr('content')
      || $('meta[property="og:description"]').attr('content')
      || $('p').first().text()
      || null;

    const dateCandidates = [
      $('meta[itemprop="startDate"]').attr('content'),
      $('time[datetime]').attr('datetime'),
      $('time').first().text(),
      $('meta[name="event:start_date"]').attr('content'),
    ].filter(Boolean) as string[];

    const starts_at = parseDateCandidates(dateCandidates);

    const cityCandidates = [
      $('meta[itemprop="addressLocality"]').attr('content'),
      $('span[itemprop="addressLocality"]').text(),
      $('[data-city]').attr('data-city'),
      $('[class*="city"]').first().text(),
    ].filter(Boolean) as string[];

    const ldMeta = extractCountryFromLdJson($, searchConfig);
    const countryCandidates = [
      $('meta[itemprop="addressCountry"]').attr('content'),
      $('span[itemprop="addressCountry"]').text(),
      $('[data-country]').attr('data-country'),
      $('[class*="country"]').first().text(),
      ldMeta.country
    ].filter(Boolean) as string[];

    const venueCandidates = [
      $('meta[itemprop="name"]').attr('content'),
      $('span[itemprop="name"]').text(),
      $('[data-venue]').attr('data-venue'),
      $('[class*="venue"]').first().text(),
    ].filter(Boolean) as string[];

    const city = normalizeText(cityCandidates[0] ?? null);
    const venue = normalizeText(venueCandidates[0] ?? null);

    let country: string | null = ldMeta.country ? normalizeCountry(ldMeta.country) : null;
    let countrySource: string | null = country ? (ldMeta.source ?? 'ld_json') : null;
    if (!country && countryCandidates.length > 0) {
      const normalizedCandidate = normalizeCountry(countryCandidates[0]);
      if (normalizedCandidate) {
        country = normalizedCandidate;
        countrySource = 'meta';
      }
    }

    if (!country) {
      const footerText = $('footer').text().toLowerCase();
      if (footerText) {
        const configCountries = Object.entries(searchConfig.locationTermsByCountry ?? {});
        for (const [countryCode, terms] of configCountries) {
          if (includesToken(footerText, terms)) {
            country = countryCode;
            countrySource = 'footer';
            break;
          }
        }
      }
      if (!country) {
        const bodyText = $('body').text().toLowerCase();
        const inferred = inferCountryFromText(bodyText, searchConfig);
        if (inferred) {
          country = inferred.code;
          countrySource = inferred.source;
        }
      }
    }

    const citySource = city ? (countrySource ?? 'content') : null;
    const location = formatLocation(city, country);
    const locationSource = location ? (city && country ? 'city_country' : city ? 'city_only' : 'country_only') : null;

    const discoveredLinksResult = await discoverLinksFromHtml($, url);
    const discoveredLinks = discoveredLinksResult.links;

    return {
      title: normalizeText(title),
      description: normalizeText(description),
      starts_at,
      country,
      countrySource,
      city,
      citySource,
      location,
      locationSource,
      venue,
      sessions: [],
      speakers: [],
      sponsors: [],
      relatedUrls: discoveredLinks,
      debugVisitedLinks: discoveredLinksResult.visited
    };
  } catch (error) {
    console.warn('[extract] cheapHtmlScrape failed', {
      url,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error
    });
    return emptyExtractedDetails();
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

const COUNTRY_ALIASES: Record<string, string> = {
  GERMANY: 'DE',
  DEUTSCHLAND: 'DE',
  FRANCE: 'FR',
  FRANKREICH: 'FR',
  ITALY: 'IT',
  ITALIEN: 'IT',
  SPAIN: 'ES',
  SPANIEN: 'ES',
  UNITED_KINGDOM: 'GB',
  UNITEDKINGDOM: 'GB',
  GREAT_BRITAIN: 'GB',
  GREATBRITAIN: 'GB',
  BRITAIN: 'GB',
  ENGLAND: 'GB',
  SCOTLAND: 'GB',
  WALES: 'GB',
  NETHERLANDS: 'NL',
  NIEDERLANDE: 'NL',
  HOLLAND: 'NL',
  BELGIUM: 'BE',
  BELGIEN: 'BE',
  AUSTRIA: 'AT',
  ÖSTERREICH: 'AT',
  OSTERREICH: 'AT',
  SWITZERLAND: 'CH',
  SCHWEIZ: 'CH',
  SCHWEIZERISCHE: 'CH'
};

function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2) return upper;
  return COUNTRY_ALIASES[upper] ?? null;
}

function parseDateCandidates(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const parsed = extractDate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function extractCountryFromLdJson($: cheerio.CheerioAPI, searchConfig: ActiveConfig): { country: string | null; source: string | null } {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const content = $(script).text();
    if (!content) continue;
    try {
      const parsed = JSON.parse(content) as Record<string, unknown> | Record<string, unknown>[];
      const objs = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of objs) {
        const address = (obj.address || (obj.location as Record<string, unknown> | undefined)?.address) as Record<string, unknown> | undefined;
        if (address && typeof address === 'object') {
          const country = address.addressCountry || address.country || address.countryCode;
          if (typeof country === 'string' && country.trim()) {
            const normalized = normalizeCountry(country);
            if (normalized) {
              return { country: normalized, source: 'ld_json' };
            }
            const inferred = inferCountryFromText(String(country), searchConfig);
            if (inferred) {
              return { country: inferred.code, source: `ld_json_${inferred.source}` };
            }
            return { country: country.trim(), source: 'ld_json_raw' };
          }
        }
      }
    } catch (error) {
      console.warn('[extract] Failed to parse LD+JSON for country', { error, url: $.root().find('title').text().slice(0, 120) });
    }
  }
  return { country: null, source: null };
}

async function extractWithFirecrawl(url: string, apiKey: string, searchConfig: ActiveConfig): Promise<ExtractedEventDetails> {
  for (let attempt = 0; attempt < FIRECRAWL_RETRY_DELAYS.length; attempt++) {
    const delay = FIRECRAWL_RETRY_DELAYS[attempt];
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const response = await withTimeout(fetch(FIRECRAWL_SCRAPE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          formats: [
            {
              type: 'json',
              prompt: generateExtractionPrompt(searchConfig)
            },
            {
              type: 'markdown'
            }
          ],
          onlyMainContent: true,
          waitFor: 2000,
          timeout: 20000
        })
      }), 8000, 'firecrawl_extract_timeout');

      if (!response.ok) {
        const body = await response.text().catch(() => null);
        console.warn('[extract] Firecrawl response not ok', {
          url,
          status: response.status,
          statusText: response.statusText,
          body: body?.slice(0, 400),
          attempt
        });
        if (attempt === FIRECRAWL_RETRY_DELAYS.length - 1) {
          throw new Error(`Firecrawl returned ${response.status}`);
        }
        continue;
      }

      const raw = await response.text();
      const repaired = await tryJsonRepair(raw);
      const parsed = JSON.parse(repaired ?? raw) as ExtractResponse;
      const candidate = extractCandidatePayload(parsed, url);
      const extracted = toExtractedEventDetails(candidate);
      if (Array.isArray(candidate?.relatedUrls) && candidate.relatedUrls.length > 0 && extracted.relatedUrls.length === 0) {
        extracted.relatedUrls = candidate.relatedUrls.filter((entry: unknown): entry is string => typeof entry === 'string');
      }
      if (isExtractEmpty(extracted)) {
        logExtractionDebug(url, 'firecrawl_json_empty', { attempt, snippet: raw.slice(0, 200) });
      } else {
        logExtractionDebug(url, 'firecrawl_json_success', { attempt, title: extracted.title, date: extracted.starts_at });
      }
      return extracted;
    } catch (error) {
      console.warn('[extract] Firecrawl attempt failed', { url, attempt, error });
      if (attempt === FIRECRAWL_RETRY_DELAYS.length - 1) {
        throw error;
      }
    }
  }

  return emptyExtractedDetails();
}

async function fallbackExtraction(url: string, apiKey: string, searchConfig: ActiveConfig): Promise<ExtractedEventDetails> {
  try {
    const response = await withTimeout(fetch(FIRECRAWL_SCRAPE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 10000
      })
    }), 10000, 'firecrawl_fallback_timeout');

    if (!response.ok) {
      console.warn('[extract] Fallback scrape failed', { url, status: response.status });
      return emptyExtractedDetails();
    }

    const text = await response.text();
    const repaired = await tryJsonRepair(text);
    let data: ExtractResponse = {};
    try {
      data = JSON.parse(repaired ?? text) as ExtractResponse;
    } catch (parseError) {
      console.warn('[extract] Fallback parse failed', { url, parseError });
    }

    const content = inferMarkdownContent(data);
    if (!content) {
      logExtractionDebug(url, 'firecrawl_markdown_empty', {});
      return emptyExtractedDetails();
    }

    const title = extractTitle(content);
    const description = extractDescription(content);
    const starts_at = extractDate(content);
    const locationGuess = extractLocation(content, url, searchConfig);
    const venue = extractVenue(content);

    const discoveredLinks = extractLinksFromMarkdown(content, url);

    const result: ExtractedEventDetails = {
      title,
      description,
      starts_at,
      country: locationGuess.country,
      countrySource: locationGuess.countrySource,
      city: locationGuess.city,
      citySource: locationGuess.citySource,
      location: formatLocation(locationGuess.city, locationGuess.country) ?? locationGuess.location,
      locationSource: locationGuess.locationSource,
      venue,
      sessions: [],
      speakers: [],
      sponsors: [],
      relatedUrls: discoveredLinks
    };
    logExtractionDebug(url, 'firecrawl_markdown_success', { title: result.title, date: result.starts_at });
    return result;
  } catch (error) {
    console.error('[extract] Fallback extraction error', { url, error });
    return emptyExtractedDetails();
  }
}

function inferMarkdownContent(value: ExtractResponse): string {
  if (!value || typeof value !== 'object') return '';

  const data = value as Record<string, unknown>;
  const direct = typeof data.markdown === 'string' ? data.markdown : null;
  if (direct) return direct;

  const nestedJson = data.json as Record<string, unknown> | undefined;
  if (nestedJson && typeof nestedJson.markdown === 'string') {
    return nestedJson.markdown;
  }

  const outputs = Array.isArray((data.outputs)) ? data.outputs : [];
  for (const entry of outputs) {
    if (entry && typeof entry === 'object') {
      const output = (entry as Record<string, unknown>).output;
      const content = (entry as Record<string, unknown>).content;
      if (output && typeof output === 'object' && typeof (output as Record<string, unknown>).markdown === 'string') {
        return (output as Record<string, unknown>).markdown as string;
      }
      if (content && typeof content === 'object' && typeof (content as Record<string, unknown>).markdown === 'string') {
        return (content as Record<string, unknown>).markdown as string;
      }
    }
  }

  return '';
}

// Simple extraction helpers
function extractTitle(content: string): string | null {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) return titleMatch[1].trim();
  return null;
}

function extractDescription(content: string): string | null {
  // Take first paragraph
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
  return paragraphs[0]?.trim() || null;
}

function extractDate(content: string): string | null {
  // Look for common date patterns with validation
  const datePatterns = [
    // ISO dates (yyyy-mm-dd)
    /(\d{4}-\d{2}-\d{2})/g,
    // German dates (dd.mm.yyyy) - validate day/month ranges
    /(\d{1,2}\.\d{1,2}\.\d{4})/g,
    // US dates (mm/dd/yyyy) - validate month/day ranges
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // German month names
    /(\d{1,2}\.\s*(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*\d{4})/gi,
    // English month names
    /(\d{1,2}\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4})/gi,
    // Event-specific patterns: "August 3–6, 2025", "June 10th - June 13th"
    /(august|september|october|november|december|january|february|march|april|may|june|july)\s+\d{1,2}[–-]\d{1,2},?\s+\d{4}/gi,
    /(august|september|october|november|december|january|february|march|april|may|june|july)\s+\d{1,2}(?:st|nd|rd|th)?\s*[–-]\s*(august|september|october|november|december|january|february|march|april|may|june|july)\s+\d{1,2}(?:st|nd|rd|th)?/gi,
    // Relative dates
    /(today|heute|tomorrow|morgen|yesterday|gestern)/gi
  ];
  
  for (const pattern of datePatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      for (const dateStr of matches) {
        try {
          let isoDate = null;
          
          // Convert German month names to ISO format
          if (dateStr.includes('januar') || dateStr.includes('january')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(januar|january)\s*(\d{4})/gi, '$3-01-$1');
          } else if (dateStr.includes('februar') || dateStr.includes('february')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(februar|february)\s*(\d{4})/gi, '$3-02-$1');
          } else if (dateStr.includes('märz') || dateStr.includes('march')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(märz|march)\s*(\d{4})/gi, '$3-03-$1');
          } else if (dateStr.includes('april')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*april\s*(\d{4})/gi, '$2-04-$1');
          } else if (dateStr.includes('mai') || dateStr.includes('may')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(mai|may)\s*(\d{4})/gi, '$3-05-$1');
          } else if (dateStr.includes('juni') || dateStr.includes('june')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(juni|june)\s*(\d{4})/gi, '$3-06-$1');
          } else if (dateStr.includes('juli') || dateStr.includes('july')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(juli|july)\s*(\d{4})/gi, '$3-07-$1');
          } else if (dateStr.includes('august')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*august\s*(\d{4})/gi, '$2-08-$1');
          } else if (dateStr.includes('september')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*september\s*(\d{4})/gi, '$2-09-$1');
          } else if (dateStr.includes('oktober') || dateStr.includes('october')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(oktober|october)\s*(\d{4})/gi, '$3-10-$1');
          } else if (dateStr.includes('november')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*november\s*(\d{4})/gi, '$2-11-$1');
          } else if (dateStr.includes('dezember') || dateStr.includes('december')) {
            isoDate = dateStr.replace(/(\d{1,2})\.?\s*(dezember|december)\s*(\d{4})/gi, '$3-12-$1');
          }
          
          // Handle relative dates
          else if (dateStr.toLowerCase().includes('today') || dateStr.toLowerCase().includes('heute')) {
            isoDate = new Date().toISOString().split('T')[0];
          } else if (dateStr.toLowerCase().includes('tomorrow') || dateStr.toLowerCase().includes('morgen')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            isoDate = tomorrow.toISOString().split('T')[0];
          }
          
          // Handle numeric dates
          else if (dateStr.includes('-')) {
            // ISO format - validate
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const day = parseInt(parts[2]);
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                isoDate = dateStr;
              }
            }
          } else if (dateStr.includes('.')) {
            // German format (dd.mm.yyyy) - validate and convert
            const parts = dateStr.split('.');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const year = parseInt(parts[2]);
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              }
            }
          } else if (dateStr.includes('/')) {
            // US format (mm/dd/yyyy) - validate and convert
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const month = parseInt(parts[0]);
              const day = parseInt(parts[1]);
              const year = parseInt(parts[2]);
              if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              }
            }
          }
          
          // Validate the final date
          if (isoDate) {
            const testDate = new Date(isoDate);
            if (!isNaN(testDate.getTime()) && testDate.getFullYear() >= 2020 && testDate.getFullYear() <= 2030) {
              return isoDate;
            }
          }
        } catch {
          // Skip invalid dates
          continue;
        }
      }
    }
  }
  
  return null;
}

function extractLocation(content: string, url: string, config: ActiveConfig): { city: string | null; country: string | null; location: string | null } {
  const lowerUrl = url.toLowerCase();
  const locationTerms = config.locationTermsByCountry ?? {};
  const countryTokens = Object.entries(locationTerms).flatMap(([countryCode, terms]) =>
    terms.map((term) => ({ countryCode, term: term.toLowerCase() }))
  );

  let country: string | null = null;
  for (const { countryCode, term } of countryTokens) {
    const hyphenated = term.replace(/\s+/g, '-');
    if (lowerUrl.includes(hyphenated) || lowerUrl.includes(term)) {
      country = countryCode;
      break;
    }
  }

  const contentLower = content.toLowerCase();
  if (!country) {
    for (const { countryCode, term } of countryTokens) {
      if (contentLower.includes(term)) {
        country = countryCode;
        break;
      }
    }
  }

  let city: string | null = null;
  let citySource: string | null = null;
  let countryFromCity: string | null = null;
  const cityKeywords = config.cityKeywordsByCountry ?? {};
  for (const [countryCode, tokens] of Object.entries(cityKeywords)) {
    for (const token of tokens) {
      if (includesToken(contentLower, [token]) || lowerUrl.includes(token.toLowerCase().replace(/\s+/g, '-'))) {
        city = token;
        citySource = includesToken(contentLower, [token]) ? 'content' : 'url';
        countryFromCity = countryCode;
        break;
      }
    }
    if (city) break;
  }

  if (!country && countryFromCity) {
    country = countryFromCity;
    countrySource = 'city_inference';
  }

  const location = formatLocation(city, country);
  const locationSource = location
    ? city && country ? 'city_country' : city ? 'city_only' : 'country_only'
    : null;
  return { city, citySource, country, countrySource, location, locationSource };
}

function extractVenue(content: string): string | null {
  // Look for venue patterns
  const venuePatterns = [
    /venue[:\s]+([^\n]+)/i,
    /location[:\s]+([^\n]+)/i,
    /ort[:\s]+([^\n]+)/i
  ];
  
  for (const pattern of venuePatterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }
  
  return null;
}

const LINK_SCORING: Array<{ weight: number; keywords: string[] }> = [
  { weight: 6, keywords: ['program', 'agenda', 'schedule', 'sessions', 'tracks', 'day'] },
  { weight: 6, keywords: ['speaker', 'speakers', 'presenter', 'faculty'] },
  { weight: 5, keywords: ['sponsor', 'partner', 'exhibitor', 'booth'] },
  { weight: 4, keywords: ['contact', 'practical', 'travel', 'venue', 'location', 'hotel', 'faq', 'info'] },
  { weight: 3, keywords: ['about', 'details', 'overview', 'why-attend'] }
];

const LINK_FETCH_THRESHOLD = 4;
const LINK_MAX_DEPTH = 3;
const LINK_MAX_FETCHES = 5;
const LINK_MAX_RESULTS = 20;
const LINK_FETCH_TIMEOUT = 2000;

type DiscoveredLinksResult = {
  links: string[];
  visited: string[];
};

function scoreLinkCandidate(url: string, text: string, classes: string | undefined): number {
  const haystacks = [url.toLowerCase(), text.toLowerCase(), (classes ?? '').toLowerCase()];
  let score = 0;
  for (const group of LINK_SCORING) {
    if (group.keywords.some((keyword) => haystacks.some((haystack) => haystack.includes(keyword)))) {
      score += group.weight;
    }
  }
  if (/download|pdf/.test(url)) score -= 2;
  if (/register|ticket/.test(url)) score -= 1;
  return score;
}

async function fetchPageContent(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINK_FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { headers: BROWSER_HEADERS, signal: controller.signal });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.warn('[link_discovery] Failed to fetch', { url, error });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverLinksFromHtml($: cheerio.CheerioAPI, baseUrl: string): Promise<DiscoveredLinksResult> {
  const base = new URL(baseUrl);
  const candidateScores = new Map<string, number>();
  const visitedPages = new Set<string>();
  const queued = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];
  const visitedLog: string[] = [];

  const processAnchors = ($page: cheerio.CheerioAPI, sourceUrl: string, depth: number) => {
    $page('a[href]').each((_, element) => {
      const href = $page(element).attr('href');
      if (!href) return;
      const normalized = normalizeUrlRelative(base, href);
      if (!normalized) return;

      const text = $page(element).text().trim();
      const classes = $page(element).attr('class');
      const score = scoreLinkCandidate(normalized, text, classes);
      if (score <= 0) return;

      const previous = candidateScores.get(normalized) ?? 0;
      if (score > previous) {
        candidateScores.set(normalized, score);
      }

      if (depth < LINK_MAX_DEPTH && score >= LINK_FETCH_THRESHOLD && !visitedPages.has(normalized) && !queued.has(normalized)) {
        queue.push({ url: normalized, depth: depth + 1 });
        queued.add(normalized);
      }
    });
  };

  processAnchors($, baseUrl, 0);

  let fetches = 0;
  while (queue.length && fetches < LINK_MAX_FETCHES) {
    const { url, depth } = queue.shift()!;
    if (visitedPages.has(url)) continue;
    visitedPages.add(url);
    visitedLog.push(url);
    fetches += 1;

    const html = await fetchPageContent(url);
    if (!html) continue;
    const child$ = cheerio.load(html);
    processAnchors(child$, url, depth);
  }

  const sorted = Array.from(candidateScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, LINK_MAX_RESULTS)
    .map(([url]) => url);

  if (sorted.length || visitedLog.length) {
    logExtractionDebug(baseUrl, 'link_discovery', {
      count: sorted.length,
      samples: sorted.slice(0, 5),
      visited: visitedLog.slice(0, 5)
    });
  }

  return { links: sorted, visited: visitedLog };
}

function normalizeUrlRelative(base: URL, href: string): string | null {
  try {
    const normalized = new URL(href, base);
    if (normalized.host !== base.host) return null;
    normalized.hash = '';
    return normalized.toString();
  } catch (error) {
    console.warn('[extract] Failed to normalize relative url', { href, error });
    return null;
  }
}

function extractLinksFromMarkdown(content: string, baseUrl: string): string[] {
  const regex = /\((https?:[^)]+)\)/g;
  const candidates = new Set<string>();
  const base = new URL(baseUrl);
  const keywords = ['program', 'agenda', 'schedule', 'speakers', 'sponsor', 'partner', 'sessions'];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const url = match[1];
    try {
      const parsed = new URL(url, base.origin);
      if (parsed.host !== base.host) continue;
      parsed.hash = '';
      const normalized = parsed.toString();
      if (keywords.some((keyword) => normalized.toLowerCase().includes(keyword))) {
        candidates.add(normalized);
      }
    } catch {
      continue;
    }
  }

  return Array.from(candidates);
}

const FALLBACK_SEGMENTS = ['program', 'agenda', 'speakers', 'sponsors', 'partner', 'contact', 'practical-information', 'venue', 'location'];

async function discoverRelatedLinks(url: string, existing: string[]): Promise<string[]> {
  const already = new Set(existing);
  const base = new URL(url);
  if (already.size === 0) {
    FALLBACK_SEGMENTS.forEach((segment) => {
      const candidateFallback = new URL(segment, base.origin + base.pathname.replace(/[^/]*$/, ''));
      already.add(candidateFallback.toString());
    });
  }
  return Array.from(already);
}

async function extractEnrichmentFromLinks(
  parentUrl: string,
  links: string[],
  apiKey: string | null,
  searchConfig: ActiveConfig
): Promise<ExtractedEventDetails> {
  if (links.length === 0) {
    return emptyExtractedDetails();
  }

  const deduped = Array.from(new Set(links)).filter((link) => link !== parentUrl).slice(0, 5);
  if (deduped.length === 0) {
    return emptyExtractedDetails();
  }

  const primary: ExtractedEventDetails[] = [];

  for (const link of deduped) {
    const basic = await cheapHtmlScrape(link, searchConfig).catch(() => emptyExtractedDetails());
    let firecrawl: ExtractedEventDetails | null = null;
    if (apiKey) {
      firecrawl = await extractWithFirecrawl(link, apiKey, searchConfig).catch(() => emptyExtractedDetails());
    }
    const merged = mergeDetails(basic, firecrawl ?? emptyExtractedDetails());
    primary.push({
      ...merged,
      relatedUrls: merged.relatedUrls.length ? merged.relatedUrls : [link]
    });
  }

  return primary.reduce((acc, curr) => mergeDetails(acc, curr), emptyExtractedDetails());
}

export async function executeEnhancedSearch(args: ExecArgs) {
  const { 
    userText = '', 
    country = 'DE', 
    dateFrom = null, 
    dateTo = null, 
    location = null,
    timeframe = null
  } = args;

  const cfg = await loadActiveConfig();
  const baseQuery = cfg.baseQuery;
  const excludeTerms = cfg.excludeTerms || '';

  // Process timeframe into date range
  const timeframeDates = processTimeframe(timeframe);
  const effectiveDateFrom = dateFrom || timeframeDates.dateFrom;
  const effectiveDateTo = dateTo || timeframeDates.dateTo;

  // Build event-focused query
  const baseQ = buildSearchQuery({ baseQuery, userText, excludeTerms });
  const locationInput = location ?? country ?? null;
  const locationContext = buildLocationContext(locationInput, cfg);
  const timeframeContext = timeframeDates;
  const q = buildEventFocusedQuery(baseQ, userText, locationContext, timeframeContext, cfg);

  console.log('[enhanced_orchestrator] Search parameters:', {
    userText,
    country,
    location,
    timeframe,
    effectiveDateFrom,
    effectiveDateTo,
    query: q
  });

  const providersTried: string[] = [];
  const logs: Array<Record<string, unknown>> = [];

  // Step 1: Search for URLs
  console.log('[enhanced_orchestrator] Step 1: Searching for URLs');
  let urls: string[] = [];
  
  // Try Firecrawl first
  try {
    providersTried.push('firecrawl');
    const firecrawlRes = await firecrawlSearch({ q, dateFrom: effectiveDateFrom, dateTo: effectiveDateTo });
    urls = firecrawlRes?.items || [];
    logs.push({ at: 'search', provider: 'firecrawl', count: urls.length, q, dateFrom: effectiveDateFrom, dateTo: effectiveDateTo });
    console.log('[enhanced_orchestrator] Firecrawl found', urls.length, 'URLs');
  } catch (error) {
    console.warn('[enhanced_orchestrator] Firecrawl failed:', error);
  }

  // Try CSE if Firecrawl didn't return enough
  if (urls.length < 10) {
    try {
      providersTried.push('cse');
      const cseRes = await cseSearch({ q, country });
      const cseUrls = cseRes?.items || [];
      urls = [...new Set([...urls, ...cseUrls])]; // Dedupe
      logs.push({ at: 'search', provider: 'cse', count: cseUrls.length, q });
      console.log('[enhanced_orchestrator] CSE added', cseUrls.length, 'more URLs');
    } catch (error) {
      console.warn('[enhanced_orchestrator] CSE failed:', error);
    }
  }

  // Database fallback if still not enough
  if (urls.length < 5) {
    try {
      providersTried.push('database');
      const dbRes = await databaseSearch({ q, country });
      const dbUrls = Array.isArray(dbRes?.items) ? (dbRes.items as string[]) : [];
      urls = [...new Set([...urls, ...dbUrls])];
      logs.push({ at: 'search', provider: 'database', count: dbUrls.length, q });
      console.log('[enhanced_orchestrator] Database fallback added', dbUrls.length, 'URLs');
    } catch (error) {
      console.warn('[enhanced_orchestrator] Database fallback failed:', error);
    }
  }

  if (urls.length === 0) {
    console.warn('[enhanced_orchestrator] No URLs found');
    return { events: [], logs, effectiveQ: q, searchRetriedWithBase: false };
  }

  // Step 2: Filter URLs to focus on actual events
  console.log('[enhanced_orchestrator] Step 2: Filtering for event URLs');
  const eventUrls = urls.filter(url => {
    const urlLower = url.toLowerCase();
    
    // Block social media and non-event platforms
    const blockedDomains = [
      'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
      'youtube.com', 'tiktok.com', 'reddit.com', 'mumsnet.com',
      'coursehero.com', 'chegg.com', 'studocu.com', 'quizlet.com'
    ];
    
    const isBlocked = blockedDomains.some(domain => urlLower.includes(domain));
    if (isBlocked) {
      console.log('[enhanced_orchestrator] Blocked URL:', url);
      return false;
    }
    
    // Look for event-related URL patterns
    const eventPatterns = [
      '/event', '/events', '/veranstaltung', '/veranstaltungen', '/konferenz', '/kongress',
      '/workshop', '/seminar', '/meeting', '/summit', '/forum', '/symposium', '/tagung',
      '/conference', '/conferences', '/training', '/course', '/kurs', '/fortbildung'
    ];
    
    // Check if URL contains event-related terms
    const hasEventPattern = eventPatterns.some(pattern => urlLower.includes(pattern));
    
    // Block non-event URL patterns
    const nonEventPatterns = [
      '/tutors-problems', '/problems', '/questions', '/answers', '/homework',
      '/study', '/learn', '/course', '/lesson', '/tutorial', '/guide',
      '/blog', '/news', '/article', '/post', '/page', '/about', '/contact'
    ];
    
    const hasNonEventPattern = nonEventPatterns.some(pattern => urlLower.includes(pattern));
    if (hasNonEventPattern) {
      console.log('[enhanced_orchestrator] Blocked non-event URL:', url);
      return false;
    }
    
    // Check if URL is from known event platforms
    const eventDomains = [
      'eventbrite', 'meetup', 'conference', 'kongress', 'veranstaltung', 'workshop',
      'seminar', 'training', 'course', 'event', 'summit', 'forum', 'symposium'
    ];
    
    const hasEventDomain = eventDomains.some(domain => urlLower.includes(domain));
    
    // Exclude obvious non-event URLs
    const excludePatterns = [
      '/blog', '/news', '/article', '/press', '/about', '/contact', '/imprint',
      '/privacy', '/terms', '/faq', '/help', '/support', '/login', '/register',
      '/shop', '/store', '/product', '/service', '/company', '/team', '/career'
    ];
    
    const hasExcludePattern = excludePatterns.some(pattern => urlLower.includes(pattern));
    
    return (hasEventPattern || hasEventDomain) && !hasExcludePattern;
  });
  
  console.log('[enhanced_orchestrator] Filtered', urls.length, 'URLs to', eventUrls.length, 'event URLs');
  logs.push({ at: 'event_filtering', inputCount: urls.length, outputCount: eventUrls.length });

  // Step 3: Deduplicate URLs
  console.log('[enhanced_orchestrator] Step 3: Deduplicating URLs');
  const uniqueUrls = [...new Set(eventUrls)];
  console.log('[enhanced_orchestrator] Deduplicated', eventUrls.length, 'URLs to', uniqueUrls.length, 'unique URLs');
  
  // Step 4: Prioritize URLs with Gemini
  console.log('[enhanced_orchestrator] Step 4: Prioritizing URLs with Gemini');
  const countryGuard = await classifyUrlsForCountry(uniqueUrls, cfg, country);
  const filteredByCountry = countryGuard.keep;
  const discardedByCountry = countryGuard.drop;
  const guardMeta = countryGuard.decisions.reduce<Record<string, { guardStatus?: 'keep' | 'drop'; guardReason?: string; guardConfidence?: number }>>((acc, decision) => {
    if (!decision?.url) return acc;
    acc[decision.url] = {
      guardStatus: decision.status,
      guardReason: decision.reason,
      guardConfidence: decision.confidence
    };
    return acc;
  }, {});
  if (discardedByCountry.length) {
    logs.push({
      at: 'country_guard',
      dropped: discardedByCountry,
      keptCount: filteredByCountry.length,
      originalCount: uniqueUrls.length
    });
  }
  if (!filteredByCountry.length) {
    console.warn('[enhanced_orchestrator] All URLs dropped by country guard');
    return {
      events: [],
      logs,
      effectiveQ: q,
      searchRetriedWithBase: false,
      providersTried
    };
  }
  const prioritizedResult = await prioritizeUrls(filteredByCountry, cfg, country, locationInput, timeframe);
  const prioritized = prioritizedResult.items;
  const geminiSucceeded = prioritizedResult.modelPath !== null && !prioritizedResult.fallbackReason;
  const prioritizationMode = prioritizedResult.fallbackReason ? 'fallback' : 'gemini';
  logs.push({
    at: 'prioritization',
    inputCount: filteredByCountry.length,
    outputCount: prioritized.length,
    location,
    modelPath: prioritizedResult.modelPath,
    fallbackReason: prioritizedResult.fallbackReason,
    prioritizationMode,
    rawResponseSnippet: prioritizedResult.rawResponse ? prioritizedResult.rawResponse.slice(0, 200) : undefined,
    reasons: prioritized.slice(0, 5).map(p => ({ url: p.url, score: p.score, reason: p.reason })),
    guard: {
      target: prioritizedResult.countryContext?.target ?? country ?? null,
      decisions: countryGuard.decisions,
      dropped: discardedByCountry
    }
  });

  if (!geminiSucceeded && prioritized.length === 0) {
    console.warn('[enhanced_orchestrator] No prioritized URLs available, skipping extraction');
    return {
      events: [],
      logs,
      effectiveQ: q,
      searchRetriedWithBase: false,
      providersTried
    };
  }

  // Step 5: Extract event details from prioritized URLs
  console.log('[enhanced_orchestrator] Step 5: Extracting event details');
  const events: ScoredEvent[] = [];
  const rejected: Array<{ url: string; reason: string; score: number }> = [];
  const maxToExtract = Math.min(prioritized.length, 6);
  
  for (let i = 0; i < maxToExtract; i++) {
    const candidate = prioritized[i];
    const url = candidate.url;
    const cached = await fetchCachedExtraction(url, null);
    if (cached) {
      const payload = (cached[0]?.payload ?? {}) as Record<string, unknown>;
      const sessions = Array.isArray(payload.sessions) ? payload.sessions as ExtractedSession[] : [];
      const speakers = Array.isArray(payload.speakers) ? payload.speakers as ExtractedSpeaker[] : [];
      const sponsors = Array.isArray(payload.sponsors) ? payload.sponsors as ExtractedSponsor[] : [];
      const relatedUrls = Array.isArray(payload.relatedUrls) ? payload.relatedUrls.filter((entry: unknown): entry is string => typeof entry === 'string') : [];
      const debugVisitedLinks = Array.isArray(payload.debugVisitedLinks) ? payload.debugVisitedLinks.filter((entry: unknown): entry is string => typeof entry === 'string') : [];
      events.push({
        id: `event_${i}`,
        title: payload.title as string ?? null,
        source_url: url,
        starts_at: payload.starts_at as string ?? null,
        country: payload.country as string ?? null,
        city: payload.city as string ?? null,
        location: payload.location as string ?? null,
        venue: payload.venue as string ?? null,
        description: payload.description as string ?? null,
        sessions,
        speakers,
        sponsors,
        confidence: Math.min(Math.max(candidate.score, 0), 1),
        confidence_reason: candidate.reason,
        countrySource: payload.countrySource as string ?? null,
        citySource: payload.citySource as string ?? null,
        locationSource: payload.locationSource as string ?? null,
        acceptedByCountryGate: guardMeta[url]?.guardStatus === 'keep',
        relatedUrls,
        debugVisitedLinks,
        scoringTrace: {
          geminiScore: candidate.reason === 'gemini' ? candidate.score : undefined,
          heuristicScore: candidate.reason?.startsWith('fallback') ? candidate.score : undefined
        }
      });
      continue;
    }

    console.log('[enhanced_orchestrator] Extracting', i + 1, 'of', maxToExtract, ':', url, 'score:', candidate.score.toFixed(3));
    
    try {
      const details = await extractEventDetails(url, cfg);
      console.log('[enhanced_orchestrator] Extracted details:', {
        url,
        title: details.title,
        country: details.country,
        city: details.city,
        location: details.location,
        venue: details.venue,
        starts_at: details.starts_at,
        countrySource: details.countrySource,
        locationSource: details.locationSource,
        citySource: details.citySource
      });
    
    // If extraction completely failed, create a basic event object
    if (!details.title && !details.description && !details.country && !details.city) {
      console.log('[enhanced_orchestrator] Extraction failed, creating basic event object for:', url);
      details.title = `Event from ${new URL(url).hostname}`;
      details.description = `Event found at ${url}`;
      details.country = null;
      details.city = null;
      details.location = null;
      details.venue = null;
      details.starts_at = null;
    }
    
    // Apply country filtering - if searching for specific country, only include events from that country
    if (country && country !== 'EU') {
      const eventCountry = details.country;
      const eventCity = details.city;
      const eventLocation = details.location;

      const matchesTarget = eventCountry?.toUpperCase() === country.toUpperCase();
      const mentionsTarget = eventLocation?.toLowerCase().includes(country.toLowerCase()) ?? false;
      const urlSuggestsTarget = url.toLowerCase().includes('.' + country.toLowerCase()) ||
        url.toLowerCase().includes('germany') ||
        url.toLowerCase().includes('deutschland');

      const hasCity = Boolean(eventCity);
      const europeanHint = !eventCountry && (details.description?.toLowerCase().includes('europe') || details.title?.toLowerCase().includes('europe'));

      if (!matchesTarget && !mentionsTarget && !urlSuggestsTarget) {
        if (hasCity && !eventCountry) {
          console.log('[enhanced_orchestrator] Accepting event with inferred city only', { url, eventCity });
        } else if (eventCountry?.toUpperCase() === 'EU' || europeanHint) {
          console.log('[enhanced_orchestrator] Accepting European-scoped event without explicit country', { url, eventCountry });
        } else {
          console.log('[enhanced_orchestrator] Filtering out uncertain country match', {
            url,
            eventCountry,
            eventCity,
            eventLocation,
            targetCountry: country,
          });
          rejected.push({ url, reason: 'country_ambiguous', score: candidate.score });
          continue;
        }
      }
    }
    
    // Apply date filtering if timeframe is specified
    if (effectiveDateFrom || effectiveDateTo) {
      const eventDate = details.starts_at;
      if (eventDate) {
        if (effectiveDateFrom && eventDate < effectiveDateFrom) {
          console.log('[enhanced_orchestrator] Filtering out event before date range:', url, 'Date:', eventDate);
          rejected.push({ url, reason: 'before_date_range', score: candidate.score });
          continue;
        }
        if (effectiveDateTo && eventDate > effectiveDateTo) {
          console.log('[enhanced_orchestrator] Filtering out event after date range:', url, 'Date:', eventDate);
          rejected.push({ url, reason: 'after_date_range', score: candidate.score });
          continue;
        }
      }
    }
    
      events.push({
        id: `event_${i}`,
        title: details.title,
        source_url: url,
        starts_at: details.starts_at,
        country: details.country,
        city: details.city,
        location: details.location,
        venue: details.venue,
        description: details.description,
        sessions: details.sessions,
        speakers: details.speakers,
        sponsors: details.sponsors,
        confidence: Math.min(Math.max(candidate.score, 0), 1),
        confidence_reason: candidate.reason,
        countrySource: details.countrySource ?? null,
        citySource: details.citySource ?? null,
        locationSource: details.locationSource ?? null,
        acceptedByCountryGate: guardMeta[url]?.guardStatus === 'keep',
        relatedUrls: details.relatedUrls,
        debugVisitedLinks: details.debugVisitedLinks,
        details,
        scoringTrace: {
          geminiScore: candidate.reason === 'gemini' ? candidate.score : undefined,
          heuristicScore: candidate.reason?.startsWith('fallback') ? candidate.score : undefined
        }
      });
    } catch (error) {
      console.error('[enhanced_orchestrator] Error extracting event from', url, error);
      // Create a basic event object even if extraction fails
      events.push({
        id: `event_${i}`,
        title: `Event from ${new URL(url).hostname}`,
        source_url: url,
        starts_at: null,
        country: null,
        city: null,
        citySource: null,
        location: null,
        locationSource: null,
        venue: null,
        description: `Event found at ${url}`,
        speakers: [],
        confidence: Math.max(candidate.score * 0.4, 0.05),
        confidence_reason: 'extraction_error',
        scoringTrace: {
          geminiScore: candidate.reason === 'gemini' ? candidate.score : undefined,
          heuristicScore: candidate.reason?.startsWith('fallback') ? candidate.score : undefined
        },
        countrySource: null,
        citySource: null,
        locationSource: null,
        acceptedByCountryGate: guardMeta[url]?.guardStatus === 'keep',
        relatedUrls: [],
        debugVisitedLinks: []
      });
    }
  }

  const finalEvents = events
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 10);

  logs.push({
    at: 'extraction',
    inputCount: prioritized.length,
    outputCount: finalEvents.length,
    keptUrls: finalEvents.map(e => ({ url: e.source_url, confidence: e.confidence, reason: e.confidence_reason })),
    rejected
  });

  console.log('[enhanced_orchestrator] Completed pipeline:', {
    searchUrls: urls.length,
    prioritizedUrls: prioritized.length,
    extractedEvents: events.length
  });

  return {
    events: finalEvents,
    logs,
    effectiveQ: q,
    searchRetriedWithBase: false,
    providersTried
  };
}

function inferCountryFromText(text: string, config: ActiveConfig): { code: string; source: string } | null {
  if (!text) return null;
  const normalized = text.toLowerCase();
  const locationTerms = config.locationTermsByCountry ?? {};
  for (const [code, terms] of Object.entries(locationTerms)) {
    if (includesToken(normalized, terms)) {
      return { code, source: 'location_terms' };
    }
  }
  const cityTerms = config.cityKeywordsByCountry ?? {};
  for (const [code, cities] of Object.entries(cityTerms)) {
    if (includesToken(normalized, cities)) {
      return { code, source: 'city_terms' };
    }
  }
  return null;
}

function buildLocationContext(location: string | null, config: ActiveConfig): LocationContext {
  const normalized = location?.trim() ?? '';
  let countries: string[];
  let label = '';

  if (!normalized) {
    countries = normalizeTargetCountries(null, config);
    label = countries.join(', ');
  } else if (normalized.toUpperCase() === 'EU') {
    countries = normalizeTargetCountries('EU', config);
    label = 'European Union';
  } else {
    countries = [normalized.toUpperCase()];
    label = countries[0];
  }

  const primary = countries[0] ?? 'DE';
  const locationTerms = config.locationTermsByCountry?.[primary] ?? [];
  const cityTerms = config.cityKeywordsByCountry?.[primary] ?? [];
  const tokens = [...locationTerms, ...cityTerms, primary].slice(0, 12);

  return {
    countries,
    primary,
    tokens,
    label
  };
}
