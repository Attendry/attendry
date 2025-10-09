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
import cheerio from 'cheerio';
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

// Helper function to process timeframe into date range using config defaults
function processTimeframe(timeframe: string | null): { dateFrom: string | null; dateTo: string | null } {
  if (!timeframe) return { dateFrom: null, dateTo: null };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (timeframe) {
    case 'next_7':
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    case 'next_14':
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    case 'next_30':
      return {
        dateFrom: today.toISOString().split('T')[0],
        dateTo: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
    case 'past_7':
      return {
        dateFrom: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      };
    case 'past_14':
      return {
        dateFrom: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      };
    case 'past_30':
      return {
        dateFrom: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0]
      };
    default:
      return { dateFrom: null, dateTo: null };
  }
}

// Helper function to process location into country codes using config defaults
function processLocation(location: string | null, config: ActiveConfig): string[] {
  const normalizedLocation = location?.trim();
  if (!normalizedLocation) {
    return config.defaultCountries?.length ? config.defaultCountries : ['DE'];
  }

  if (normalizedLocation.toUpperCase() === 'EU') {
    return config.euCountries?.length ? config.euCountries : ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'MT', 'CY', 'IE', 'PT', 'GR'];
  }

  return [normalizedLocation.toUpperCase()];
}

// Event-focused query builder derived from search configuration
function buildEventFocusedQuery(baseQuery: string, userText: string, location: string | null, searchConfig: ActiveConfig): string {
  const countries = processLocation(location, searchConfig);
  const eventTerms = searchConfig.eventTerms?.length
    ? searchConfig.eventTerms
    : ['conference', 'event', 'summit', 'workshop', 'seminar', 'meeting', 'symposium', 'forum', 'exhibition', 'trade show', 'convention', 'congress'];
  const eventQuery = `(${eventTerms.join(' OR ')})`;

  if (countries.length === 1) {
    const country = countries[0];
    const countryTermsSource = searchConfig.locationTermsByCountry?.[country];
    const effectiveCountryTerms = countryTermsSource?.length ? countryTermsSource : [country];
    const locationTerms = effectiveCountryTerms.slice(0, 8).join(' OR ');
    return `${baseQuery} ${eventQuery} (${locationTerms})`;
  }

  const euTerms = searchConfig.euLocationTerms?.length
    ? searchConfig.euLocationTerms
    : ['Europe', 'Europa', 'European', 'Europäisch', 'EU'];
  const locationTerms = euTerms.join(' OR ');
  return `${baseQuery} ${eventQuery} (${locationTerms})`;
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
};

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
    city: primary.city ?? fallback.city ?? null,
    location: primary.location ?? fallback.location ?? null,
    venue: primary.venue ?? fallback.venue ?? null,
    sessions: mergeArray(primary.sessions, fallback.sessions, (session) => session.title ?? session.description ?? JSON.stringify(session)),
    speakers: mergeArray(primary.speakers, fallback.speakers, (speaker) => speaker.name ?? JSON.stringify(speaker)),
    sponsors: mergeArray(primary.sponsors, fallback.sponsors, (sponsor) => sponsor.name ?? JSON.stringify(sponsor)),
    relatedUrls: mergeArray(primary.relatedUrls, fallback.relatedUrls)
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

    // Build context from search config
    const industry = searchConfig.industry || 'general';
    const baseQuery = searchConfig.baseQuery || '';
    const excludeTerms = searchConfig.excludeTerms || '';
    
    // Process location context derived from config
    const countries = processLocation(location, searchConfig);
    const locationContext = countries.length === 1 ? 
      `in ${countries[0]}` : 
      `in ${countries.slice(0, 5).join(', ')} countries`;
    
    // Process timeframe context
    const timeframeContext = timeframe ? 
      `within the ${timeframe.replace('_', ' ')} timeframe` : 
      'within the specified timeframe';
    
    const prompt = `You are an expert in ${industry} events and conferences. 

SEARCH CONTEXT:
- Industry: ${industry}
- Base Query: ${baseQuery}
- Exclude Terms: ${excludeTerms}
- Location: ${locationContext}
- Timeframe: ${timeframeContext}

TASK: From the URLs below, return the top 10 most relevant for ${industry} events that are:
1. Actually taking place ${locationContext} (events mentioning ${locationContext} or taking place there)
2. ${timeframeContext}
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
        fallbackReason: 'parse_failure'
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
  const basic = await cheapHtmlScrape(url).catch(err => {
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
        sessions: merged.sessions,
        speakers: merged.speakers,
        sponsors: merged.sponsors,
        relatedUrls: merged.relatedUrls
      }
    });
  }

  const discoveredLinks = merged.relatedUrls.length > 0
    ? merged.relatedUrls
    : await discoverRelatedLinks(url, merged.relatedUrls);

  const enrichment = await extractEnrichmentFromLinks(url, discoveredLinks, apiKey, searchConfig);
  const enrichedMerged = mergeDetails(merged, enrichment);

  return {
    ...enrichedMerged,
    location: normalizedLocation ?? enrichedMerged.location ?? null,
    relatedUrls: discoveredLinks
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
    relatedUrls: []
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

async function cheapHtmlScrape(url: string): Promise<ExtractedEventDetails> {
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

    const countryCandidates = [
      $('meta[itemprop="addressCountry"]').attr('content'),
      $('span[itemprop="addressCountry"]').text(),
      $('[data-country]').attr('data-country'),
      $('[class*="country"]').first().text(),
      extractCountryFromLdJson($)
    ].filter(Boolean) as string[];

    const venueCandidates = [
      $('meta[itemprop="name"]').attr('content'),
      $('span[itemprop="name"]').text(),
      $('[data-venue]').attr('data-venue'),
      $('[class*="venue"]').first().text(),
    ].filter(Boolean) as string[];

    const city = normalizeText(cityCandidates[0] ?? null);
    const country = normalizeCountry(countryCandidates[0] ?? null);
    const venue = normalizeText(venueCandidates[0] ?? null);

    const discoveredLinks = discoverLinksFromHtml($, url);

    return {
      title: normalizeText(title),
      description: normalizeText(description),
      starts_at,
      country,
      city,
      location: formatLocation(city, country),
      venue,
      sessions: [],
      speakers: [],
      sponsors: [],
      relatedUrls: discoveredLinks
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

function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2) return upper;
  const known: Record<string, string> = {
    GERMANY: 'DE',
    DE: 'DE',
    DEUTSCHLAND: 'DE',
  };
  return known[upper] ?? null;
}

function parseDateCandidates(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const parsed = extractDate(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function extractCountryFromLdJson($: cheerio.CheerioAPI): string | null {
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
            return country.trim();
          }
        }
      }
    } catch (error) {
      console.warn('[extract] Failed to parse LD+JSON for country', { error, url: $.root().find('title').text().slice(0, 120) });
    }
  }
  return null;
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
      city: locationGuess.city,
      location: formatLocation(locationGuess.city, locationGuess.country) ?? locationGuess.location,
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
  if (country) {
    const cityTokens = config.cityKeywordsByCountry?.[country] ?? [];
    for (const token of cityTokens) {
      if (includesToken(contentLower, [token])) {
        city = token;
        break;
      }
    }
  }

  const location = formatLocation(city, country);
  return { city, country, location };
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

function discoverLinksFromHtml($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const anchors = $('a[href]').toArray();
  const keywords = ['program', 'agenda', 'schedule', 'speakers', 'sponsors', 'partner', 'sessions'];
  const base = new URL(baseUrl);
  const results = new Set<string>();

  anchors.forEach((element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const normalized = normalizeUrlRelative(base, href);
    if (!normalized) return;
    const lower = normalized.toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword))) {
      results.add(normalized);
    }
  });

  return Array.from(results);
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

async function discoverRelatedLinks(url: string, existing: string[]): Promise<string[]> {
  const already = new Set(existing);
  const base = new URL(url);
  if (already.size === 0) {
    const segments = ['program', 'agenda', 'speakers', 'sponsors', 'partner'];
    segments.forEach((segment) => {
      const candidate = new URL(segment + '.html', base.origin + base.pathname.replace(/[^/]*$/, ''));
      already.add(candidate.toString());
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
    const basic = await cheapHtmlScrape(link).catch(() => emptyExtractedDetails());
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
  const q = buildEventFocusedQuery(baseQ, userText, location, cfg);

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
  const prioritizedResult = await prioritizeUrls(uniqueUrls, cfg, country, location, timeframe);
  const prioritized = prioritizedResult.items;
  const geminiSucceeded = prioritizedResult.modelPath !== null && !prioritizedResult.fallbackReason;
  logs.push({
    at: 'prioritization',
    inputCount: uniqueUrls.length,
    outputCount: prioritized.length,
    location,
    modelPath: prioritizedResult.modelPath,
    fallbackReason: prioritizedResult.fallbackReason,
    reasons: prioritized.slice(0, 5).map(p => ({ url: p.url, score: p.score, reason: p.reason }))
  });

  if (!geminiSucceeded) {
    console.warn('[enhanced_orchestrator] Skipping extraction - Gemini prioritisation unavailable');
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
      events.push({
        id: `event_${i}`,
        title: cached.payload?.title ?? null,
        source_url: url,
        starts_at: cached.payload?.starts_at ?? null,
        country: cached.payload?.country ?? null,
        city: cached.payload?.city ?? null,
        location: cached.payload?.location ?? null,
        venue: cached.payload?.venue ?? null,
        description: cached.payload?.description ?? null,
        speakers: cached.payload?.speakers ?? [],
        confidence: Math.min(Math.max(candidate.score, 0), 1),
        confidence_reason: candidate.reason,
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
        starts_at: details.starts_at
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

      if (!matchesTarget && !mentionsTarget && !urlSuggestsTarget) {
        // Allow European tagged events when country is 'EU'
        if (eventCountry?.toUpperCase() === 'EU') {
          // Accept; the event is relevant to European audiences.
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
        speakers: [],
        confidence: Math.min(Math.max(candidate.score, 0), 1),
        confidence_reason: candidate.reason,
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
        location: null,
        venue: null,
        description: `Event found at ${url}`,
        speakers: [],
        confidence: Math.max(candidate.score * 0.4, 0.05),
        confidence_reason: 'extraction_error',
        scoringTrace: {
          geminiScore: candidate.reason === 'gemini' ? candidate.score : undefined,
          heuristicScore: candidate.reason?.startsWith('fallback') ? candidate.score : undefined
        }
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
