// Enhanced orchestrator with full pipeline: Search → Prioritization → Extract
import { loadActiveConfig, type ActiveConfig } from './config';
import { buildSearchQuery } from './queryBuilder';
import { search as firecrawlSearch } from '../../providers/firecrawl';
import { search as cseSearch } from '../../providers/cse';
import { search as databaseSearch } from '../../providers/database';

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

type ExtractedEventDetails = {
  title: string | null;
  description: string | null;
  starts_at: string | null;
  country: string | null;
  city: string | null;
  location: string | null;
  venue: string | null;
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

type ExtractResponse = {
  data?: {
    json?: unknown;
    outputs?: Array<{ output?: unknown; content?: unknown }>;
  };
  outputs?: Array<{ output?: unknown; content?: unknown }>;
};

function extractCandidatePayload(raw: ExtractResponse | null | undefined): unknown {
  if (!raw) return null;
  if (raw.data?.json) return raw.data.json;
  if (raw.data?.outputs?.length) return raw.data.outputs[0]?.output ?? raw.data.outputs[0]?.content;
  if (raw.outputs?.length) return raw.outputs[0]?.output ?? raw.outputs[0]?.content;
  return raw;
}

function toExtractedEventDetails(source: unknown): ExtractedEventDetails {
  if (!source) {
    return {
      title: null,
      description: null,
      starts_at: null,
      country: null,
      city: null,
      location: null,
      venue: null
    };
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

  return {
    title,
    description,
    starts_at: startsAt,
    country,
    city,
    location,
    venue
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
    venue: primary.venue ?? fallback.venue ?? null
  };
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

// Industry-agnostic Gemini prioritization
async function prioritizeUrls(urls: string[], searchConfig: ActiveConfig, country: string, location: string | null, timeframe: string | null): Promise<PrioritizedUrl[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[prioritization] No GEMINI_API_KEY, returning all URLs');
      return urls.map((url, idx) => ({ url, score: 0.4 - idx * 0.01 }));
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

    const modelPath = process.env.GEMINI_MODEL_PATH || 'v1/models/gemini-1.5-flash-latest:generateContent';
    const response = await fetch(`https://generativelanguage.googleapis.com/${modelPath}?key=${apiKey}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn('[prioritization] Gemini API failed:', response.status, errorText);
      console.warn('[prioritization] API Key length:', apiKey?.length || 0);
      console.warn('[prioritization] API Key starts with:', apiKey?.substring(0, 10) || 'N/A');
      return urls.slice(0, 10).map((url, idx) => ({
        url,
        score: 0.3 - idx * 0.02,
        reason: 'fallback_first_pass'
      }));
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.warn('[prioritization] No content in Gemini response');
      return urls.slice(0, 10).map((url, idx) => ({
        url,
        score: 0.3 - idx * 0.02,
        reason: 'no_content'
      }));
    }

    try {
      const prioritized = JSON.parse(content) as GeminiPrioritizedItem[];
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
          return normalized;
        }
      }
    } catch (parseError) {
      console.warn('[prioritization] Failed to parse Gemini response:', parseError);
    }

    return urls.slice(0, 10).map((url, idx) => ({
      url,
      score: 0.3 - idx * 0.02,
      reason: 'parse_failure'
    }));
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
    
    return prioritized.length > 0
      ? prioritized.map(item => ({ ...item, reason: 'fallback_heuristic' }))
      : urls.slice(0, 10).map((url, idx) => ({ url, score: 0.1 - idx * 0.01, reason: 'fallback_default' }));
  }
}

// Event extraction using Firecrawl Extract (not Gemini)
async function extractEventDetails(url: string, searchConfig: ActiveConfig): Promise<ExtractedEventDetails> {
  try {
    const apiKey = process.env.FIRECRAWL_KEY || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn('[extract] No Firecrawl API key');
      return { title: null, description: null, starts_at: null, country: null, venue: null };
    }

    // Use Promise.race to add timeout to prevent 300-second timeouts
    const extractPromise = fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: [
          {
            type: "json",
            prompt: `You are extracting structured event information for the ${searchConfig.industry} industry.
Return a compact JSON object with the following shape:
{
  "title": string | null,
  "description": string | null,
  "starts_at": string | null,
  "country": string | null,
  "city": string | null,
  "location": string | null,
  "venue": string | null
}

Rules:
- Prefer ISO date format YYYY-MM-DD for "starts_at" when possible. If unavailable, return null.
- Derive city/country from the page content or metadata. Use ISO country codes where possible.
- "location" should be a human readable string (e.g. "Munich, Germany").
- Only populate fields when the page clearly describes an actual event (conference, workshop, summit, seminar, etc.).
- Leave any unknown field as null.
- Avoid hallucinating information not present on the page.`
          }
        ],
        onlyMainContent: true,
        timeout: 30000
      })
    });

                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Extraction timeout')), 5000) // 5 second timeout
                );

    const response = await Promise.race([extractPromise, timeoutPromise]) as Response;

    if (!response.ok) {
      console.warn('[extract] Firecrawl extract failed for', url, response.status);
      // Fallback to simple scraping
      return await fallbackExtraction(url, apiKey, searchConfig);
    }

    let data;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('[extract] Failed to parse Firecrawl extract response for', url, parseError);
      // Fallback to simple scraping
      return await fallbackExtraction(url, apiKey, searchConfig);
    }
    
    const extractedCandidate = extractCandidatePayload(data);
    const extracted = toExtractedEventDetails(extractedCandidate);
    const locationFormatted = formatLocation(extracted.city, extracted.country) ?? extracted.location;

    const fallbackDetails = await fallbackExtraction(url, apiKey, searchConfig).catch((err: unknown) => {
      console.warn('[extract] Fallback extraction during merge failed', { url, err });
      return {
        title: null,
        description: null,
        starts_at: null,
        country: null,
        city: null,
        location: null,
        venue: null
      } as ExtractedEventDetails;
    });
    const merged = mergeDetails({ ...extracted, location: locationFormatted }, fallbackDetails);
    return {
      ...merged,
      location: merged.location ?? formatLocation(merged.city, merged.country)
    };
  } catch (error) {
    console.error('[extract] Error extracting', url, error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('[extract] Extraction timed out for', url);
    }
    return {
      title: null,
      description: null,
      starts_at: null,
      country: null,
      city: null,
      location: null,
      venue: null
    };
  }
}

// Fallback extraction using simple scraping
async function fallbackExtraction(url: string, apiKey: string, searchConfig: ActiveConfig): Promise<ExtractedEventDetails> {
  try {
    const scrapePromise = fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000
      })
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Scrape timeout')), 4000)
    );

    const response = await Promise.race([scrapePromise, timeoutPromise]) as Response;

    if (!response.ok) {
      console.warn('[extract] Fallback scrape failed for', url, response.status);
      return {
        title: null,
        description: null,
        starts_at: null,
        country: null,
        city: null,
        location: null,
        venue: null
      };
    }

    const text = await response.text();
    let data: ExtractResponse;
    try {
      data = JSON.parse(text) as ExtractResponse;
    } catch {
      data = {};
    }

    const inferMarkdown = (value: unknown): string | null => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object') {
        const maybeMarkdown = (value as Record<string, unknown>).markdown;
        if (typeof maybeMarkdown === 'string') return maybeMarkdown;
      }
      return null;
    };

    const content = inferMarkdown(data.data?.json) ??
      inferMarkdown(data.data?.outputs?.[0]?.output) ??
      inferMarkdown(data.data?.outputs?.[0]?.content) ?? '';
    
    // Use simple extraction helpers
    const title = extractTitle(content);
    const description = extractDescription(content);
    const starts_at = extractDate(content);
    const locationGuess = extractLocation(content, url, searchConfig);
    const venue = extractVenue(content);

    const locationFormatted = formatLocation(locationGuess.city, locationGuess.country) ?? locationGuess.location;

    return {
      title,
      description,
      starts_at,
      country: locationGuess.country,
      city: locationGuess.city,
      location: locationFormatted,
      venue
    };
  } catch (error) {
    console.error('[extract] Fallback extraction error:', error);
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('[extract] Fallback extraction timed out for', url);
    }
    return {
      title: null,
      description: null,
      starts_at: null,
      country: null,
      city: null,
      location: null,
      venue: null
    };
  }
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
  const prioritized = await prioritizeUrls(uniqueUrls, cfg, country, location, timeframe);
  logs.push({
    at: 'prioritization',
    inputCount: uniqueUrls.length,
    outputCount: prioritized.length,
    location,
    modelPath: process.env.GEMINI_MODEL_PATH || 'v1/models/gemini-1.5-flash-latest:generateContent',
    reasons: prioritized.slice(0, 5).map(p => ({ url: p.url, score: p.score, reason: p.reason }))
  });

  // Step 5: Extract event details from prioritized URLs
  console.log('[enhanced_orchestrator] Step 5: Extracting event details');
  const events: ScoredEvent[] = [];
  const rejected: Array<{ url: string; reason: string; score: number }> = [];
  const maxToExtract = Math.min(prioritized.length, 6);
  
  for (let i = 0; i < maxToExtract; i++) {
    const candidate = prioritized[i];
    const url = candidate.url;
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
      
      console.log('[enhanced_orchestrator] Checking event location:', {
        url,
        eventCountry,
        eventCity,
        eventLocation,
        targetCountry: country
      });
      
      // Check if event mentions target country in location
      const mentionsTargetCountry = eventLocation && 
        (eventLocation.toLowerCase().includes(country.toLowerCase()) ||
         eventLocation.toLowerCase().includes('germany') ||
         eventLocation.toLowerCase().includes('deutschland'));
      
      // Check if event is in a German city (for Germany searches)
      const isInGermanCity = country === 'DE' && eventCity && 
        ['berlin', 'münchen', 'frankfurt', 'hamburg', 'köln', 'stuttgart', 'düsseldorf', 'leipzig', 'hannover', 'nürnberg', 'bremen', 'bonn', 'essen', 'mannheim', 'münster'].some(city => 
          eventCity.toLowerCase().includes(city.toLowerCase()));
      
      // Check if URL suggests German location
      const urlSuggestsGerman = url.toLowerCase().includes('.de') || 
        url.toLowerCase().includes('germany') || 
        url.toLowerCase().includes('deutschland');
      
      // Be stricter - filter out if we have evidence it's NOT German
      const isDefinitelyNotGerman = eventCountry && 
        !['DE', 'AT', 'CH'].includes(eventCountry) && 
        !urlSuggestsGerman && 
        !mentionsTargetCountry && 
        !isInGermanCity;
      
      // Additional check for obvious US cities
      const isObviousUSCity = eventCity && 
        ['kansas city', 'nashville', 'houston', 'chicago', 'new york', 'los angeles', 'san francisco', 'boston', 'atlanta', 'miami', 'seattle', 'denver'].includes(eventCity.toLowerCase());
      
      // Also check URL for US city patterns
      const urlContainsUSCity = url.toLowerCase().includes('kansas-city') || 
        url.toLowerCase().includes('nashville') || 
        url.toLowerCase().includes('houston') || 
        url.toLowerCase().includes('chicago') || 
        url.toLowerCase().includes('new-york') || 
        url.toLowerCase().includes('los-angeles') || 
        url.toLowerCase().includes('san-francisco') || 
        url.toLowerCase().includes('boston') || 
        url.toLowerCase().includes('atlanta') || 
        url.toLowerCase().includes('miami') || 
        url.toLowerCase().includes('seattle') || 
        url.toLowerCase().includes('denver');
      
      const shouldFilterOut = isDefinitelyNotGerman || isObviousUSCity || urlContainsUSCity;
      
      if (shouldFilterOut) {
        console.log('[enhanced_orchestrator] Filtering out non-German event:', url, 'Country:', eventCountry, 'City:', eventCity, 'Location:', eventLocation);
        rejected.push({ url, reason: 'country_mismatch', score: candidate.score });
        continue;
      } else {
        console.log('[enhanced_orchestrator] Keeping event (German or ambiguous):', url, 'Country:', eventCountry, 'City:', eventCity, 'Location:', eventLocation);
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
