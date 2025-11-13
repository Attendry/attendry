import { RetryService } from "./retry-service";
import { buildSearchQuery } from '@/search/query';
import { buildUnifiedQuery } from '@/lib/unified-query-builder';
import { getCountryContext, type CountryContext } from '@/lib/utils/country';
import { parseEventDate } from '@/search/date';
import { EVENT_KEYWORDS, SOCIAL_DOMAINS, DEFAULT_SHARD_KEYWORDS, detectCountryFromText, detectCityFromText } from '@/config/search-dictionaries';

/**
 * Firecrawl Search Service
 * 
 * Provides web search capabilities using Firecrawl's Search API
 * with structured event extraction and intelligent filtering.
 */

export interface FirecrawlSearchParams {
  query: string;
  country?: string;
  from?: string;
  to?: string;
  industry?: string;
  maxResults?: number;
  tbs?: string;
  countryContext?: CountryContext;
  locale?: string;
  location?: string;
}

export interface FirecrawlSearchResult {
  provider: string;
  items: SearchItem[];
  cached: boolean;
  searchMetadata?: {
    totalResults?: number;
    searchTime?: number;
    query?: string;
  };
}

export interface SearchItem {
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
 * Event-focused search schema for Firecrawl
 */
const EVENT_SEARCH_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          snippet: { type: "string" },
          eventDate: { type: "string" },
          location: { type: "string" },
          organizer: { type: "string" },
          eventType: { type: "string" },
          confidence: { type: "number" }
        },
        required: ["title", "url", "snippet"]
      }
    }
  },
  required: ["events"]
};

/**
 * Firecrawl Search Service Class
 */
export class FirecrawlSearchService {
  private static readonly FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";
  private static readonly MAX_RESULTS = 20;
  private static readonly SEARCH_TIMEOUT = Math.max(
    Number(process.env.FIRECRAWL_SEARCH_TIMEOUT_MS ?? 30000),
    20000,
  );

  /**
   * PHASE 1 OPTIMIZATION: Get adaptive timeout with exponential backoff and jitter
   * Timeouts: 8s → 12s → 18s with 0-20% jitter
   * Made public for use by unified-search-core.ts
   */
  static getAdaptiveTimeout(attempt: number): number {
    const timeouts = [8000, 12000, 18000]; // 8s → 12s → 18s
    const attemptIndex = Math.min(attempt, timeouts.length - 1);
    const baseTimeout = timeouts[attemptIndex];
    const jitter = Math.random() * 0.2; // 0-20% jitter
    return Math.floor(baseTimeout * (1 + jitter));
  }

  /**
   * PHASE 1 OPTIMIZATION: Fetch with adaptive retry and exponential backoff timeouts
   * Made public for use by unified-search-core.ts
   */
  static async fetchWithAdaptiveRetry(
    service: string,
    operation: string,
    url: string,
    options: RequestInit,
    initialTimeout: number
  ): Promise<Response> {
    const maxRetries = 2; // 3 total attempts (0, 1, 2)
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const timeout = this.getAdaptiveTimeout(attempt);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Check for retryable status codes
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        const isRetryable = 
          (error instanceof Error && (
            error.name === 'AbortError' ||
            error.message.includes('timeout') ||
            error.message.includes('429') ||
            error.message.includes('500') ||
            error.message.includes('502') ||
            error.message.includes('503') ||
            error.message.includes('504')
          ));

        if (!isRetryable || attempt === maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter (from RetryService config)
        const baseDelay = 2000;
        const backoffMultiplier = 2.5;
        const jitterMs = 1000;
        const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt);
        const jitter = Math.random() * jitterMs;
        const delay = Math.floor(exponentialDelay + jitter);

        console.log(JSON.stringify({
          at: 'firecrawl_adaptive_retry',
          service,
          operation,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delay,
          timeout: this.getAdaptiveTimeout(attempt + 1),
          error: lastError.message,
          retrying: true
        }));

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Adaptive retry failed unexpectedly');
  }

  /**
   * Execute a web search using Firecrawl Search API v2
   */
  static async searchEvents(params: FirecrawlSearchParams): Promise<FirecrawlSearchResult> {
    const { query, country = "", from, to, industry = "legal-compliance", maxResults = this.MAX_RESULTS, countryContext, locale, location } = params;
    
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_KEY not configured");
    }

    const resolvedCountryContext = countryContext ?? (country ? getCountryContext(country) : undefined);
    const targetCountry = (resolvedCountryContext?.iso2 || country || '').toUpperCase();
    const locationTokenSet = this.buildLocationTokenSet(resolvedCountryContext || null, country);
    const timeframeTokens = this.buildTimeframeTokens(from, to, locale);
    const { tokens: positiveTokens, topicalTokens } = this.extractPositiveTokens(query, industry, locationTokenSet);
    const baseTokens = topicalTokens.length ? topicalTokens : positiveTokens;
    const matchTokensSource = [...baseTokens, ...timeframeTokens];
    const matchTokens = matchTokensSource.length ? matchTokensSource.map((token) => token.toLowerCase()) : [];

    const ships: Array<{ query: string; params: Record<string, unknown>; label: string }> = [];

    const primaryQuery = this.buildShardQuery(positiveTokens, locationTokenSet, timeframeTokens, country, from, to);
    const fallbackQuery = await this.buildSearchQueryInternal(query, industry, country, from, to);

    const baseParams = {
      limit: Math.min(maxResults, 20),
      sources: ["web"],
      location: location || resolvedCountryContext?.countryNames?.[0] || this.mapCountryToLocation(country),
      country: resolvedCountryContext?.iso2 || country?.toUpperCase() || undefined,
      tbs: this.buildTimeBasedSearch(from, to),
      ignoreInvalidURLs: true,
    };

    ships.push({ query: primaryQuery, params: baseParams, label: 'shard' });
    if (fallbackQuery !== primaryQuery) {
      ships.push({ query: fallbackQuery, params: baseParams, label: 'full' });
    }

    let lastError: unknown;
    for (const ship of ships) {
      try {
        const payload = { ...ship.params, query: ship.query };
        console.log(JSON.stringify({ at: 'firecrawl_call', label: ship.label, query: ship.query, params: payload }));

      // PHASE 1 OPTIMIZATION: Adaptive timeout with exponential backoff and jitter
      // Timeouts: 8s → 12s → 18s with 0-20% jitter to reduce timeout failures by 30%
      const adaptiveTimeout = this.getAdaptiveTimeout(0); // Start with first attempt
      const response = await this.fetchWithAdaptiveRetry(
        "firecrawl",
        "search",
        this.FIRECRAWL_SEARCH_URL,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        },
        adaptiveTimeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl Search API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
        console.log(JSON.stringify({ at: 'firecrawl_call_result', label: ship.label, status: response.status, success: data.success, webResults: data.data?.web?.length || 0 }));

      const items: SearchItem[] = [];
      if (data.success && data.data?.web) {
        for (const result of data.data.web) {
          const url = result.url || "";
          const hostname = new URL(url).hostname.toLowerCase();
          if (SOCIAL_DOMAINS.includes(hostname)) {
              continue;
          }
          
          const content = (result.title + " " + result.description + " " + (result.markdown || "")).toLowerCase();
          const isEventRelated = this.isEventRelated(content);
            if (!isEventRelated) continue;

            const hasPositiveMatch = !matchTokens.length || matchTokens.some((token) => token.length > 2 && content.includes(token));
            if (!hasPositiveMatch) {
              continue;
            }

            const extractedDateRaw = this.extractDateFromContent(result.markdown)
              ?? this.extractDateFromContent(result.title)
              ?? this.extractDateFromContent(result.description);
            const parsedDate = extractedDateRaw ? parseEventDate(extractedDateRaw) : { startISO: null, endISO: null, confidence: 'low' };

            const hasSomeDate = Boolean(parsedDate.startISO);
            const withinRange = this.isWithinRange(parsedDate.startISO, from, to);
            const timeframeHint = this.matchesTimeframeHint(content, timeframeTokens);

            if (from || to) {
              if (parsedDate.startISO && !withinRange) {
                continue;
              }
            } else if (!hasSomeDate && !timeframeHint) {
              continue;
            }

            const extractedLocation = this.extractLocationFromContent(result.markdown);
            const extractedOrganizer = this.extractOrganizerFromContent(result.markdown);

            const countryMismatch = targetCountry && extractedLocation && !this.matchesCountry(hostname, extractedLocation, targetCountry);
            
            items.push({
              title: result.title || "Event",
              link: result.url || "",
              snippet: result.description || result.markdown?.substring(0, 200) || "",
              extractedData: {
                eventTitle: result.title,
                eventDate: parsedDate.startISO ?? extractedDateRaw ?? undefined,
                location: extractedLocation || undefined,
                organizer: extractedOrganizer || undefined,
                confidence: this.calculateRelevanceScore(content, parsedDate.startISO, extractedLocation) - (countryMismatch ? 0.2 : 0),
              }
            });
        }
      }

        if (items.length) {
      return {
        provider: "firecrawl",
        items: items.slice(0, maxResults),
        cached: false,
        searchMetadata: {
          totalResults: items.length,
              query: ship.query
            }
          };
        }

        lastError = new Error('firecrawl_empty_results');
    } catch (error) {
        lastError = error;
        console.warn(JSON.stringify({ at: 'firecrawl_call_failure', label: ship.label, error: error instanceof Error ? error.message : String(error) }));
        if (ship !== ships[ships.length - 1]) {
          console.info(JSON.stringify({ at: 'firecrawl_call_retry', next: ships[ships.indexOf(ship) + 1]?.label }));
        }
      }
    }

    if (!lastError) {
      return { provider: 'firecrawl', items: [], cached: false };
    }

    if (lastError instanceof Error && (lastError.name === 'TimeoutError' || lastError.message.includes('timeout'))) {
      console.warn('Firecrawl search timed out after configured budget');
    }

    if (lastError instanceof Error && lastError.message === 'firecrawl_empty_results') {
      return { provider: 'firecrawl', items: [], cached: false };
    }

    console.error('Firecrawl Search failed:', lastError);
    throw lastError instanceof Error ? lastError : new Error('firecrawl_failed');
  }

  /**
   * Build search query with event-specific terms
   */
  private static async buildSearchQueryInternal(
    query: string, 
    industry: string, 
    country: string, 
    from?: string, 
    to?: string
  ): Promise<string> {
    try {
      const result = await buildUnifiedQuery({
        userText: query,
        country: country,
        dateFrom: from,
        dateTo: to,
        language: 'en'
      });
      return result.query;
    } catch (error) {
      console.warn('[firecrawl-search-service] Failed to use unified query builder, using fallback:', error);
      
      let searchQuery = query.trim();
      
      if (!searchQuery || searchQuery.length < 5) {
        const industryTerms = this.getIndustryTerms(industry);
        searchQuery = `${industryTerms} conference`;
      }

      const baseQuery = searchQuery || this.getIndustryTerms(industry);
      return buildSearchQuery({ baseQuery, userText: undefined });
    }
  }

  private static buildShardQuery(
    tokens: string[],
    locationTokens: Set<string>,
    timeframeTokens: string[],
    country: string,
    from?: string,
    to?: string
  ): string {
    const keywords: string[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      const formatted = this.formatTokenForQuery(token);
      if (!formatted || seen.has(formatted)) continue;
      keywords.push(formatted);
      seen.add(formatted);
      if (keywords.length >= 6) break;
    }

    if (!keywords.some((word) => EVENT_KEYWORDS.includes(word))) {
      keywords.push('event');
    }

    const locationKeywords = Array.from(locationTokens)
      .filter((token) => token.length > 2)
      .slice(0, 2)
      .map((token) => this.formatTokenForQuery(token));

    for (const loc of locationKeywords) {
      if (loc && !seen.has(loc)) {
        keywords.push(loc);
        seen.add(loc);
      }
    }

    const year = this.deriveYear(from, to);
    if (year && !seen.has(year)) {
      keywords.push(year);
      seen.add(year);
    }

    timeframeTokens.forEach((token) => {
      const formatted = this.formatTokenForQuery(token);
      if (formatted && !seen.has(formatted)) {
        keywords.push(formatted);
        seen.add(formatted);
      }
    });

    if (country) {
      const countryToken = this.formatTokenForQuery(country);
      if (countryToken && !seen.has(countryToken)) {
        keywords.push(countryToken);
        seen.add(countryToken);
      }
    }

    return keywords.join(' ');
  }

  private static extractPositiveTokens(query: string, industry: string, locationTokens: Set<string>): { tokens: string[]; topicalTokens: string[] } {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      const fallback = this.getIndustryTerms(industry).split(' ').filter(Boolean);
      return { tokens: fallback, topicalTokens: fallback };
    }

    const positiveSegments = normalized
      .split(/\s+-/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0 && !segment.startsWith('-'));

    const tokens = new Set<string>();
    const topical = new Set<string>();

    for (const segment of positiveSegments) {
      const inner = segment.replace(/[()]/g, ' ');
      for (const raw of inner.split(/\bOR\b|\bAND\b|\bNOT\b/i)) {
        const token = raw.trim().replace(/"/g, ' ');
        if (!token) continue;
        const pieces = token.split(/\s+/).filter(Boolean);
        for (const piece of pieces) {
          const formatted = this.formatTokenForQuery(piece);
          if (!formatted) continue;
          tokens.add(formatted);
          if (!locationTokens.has(formatted.toLowerCase())) {
            topical.add(formatted);
          }
        }
      }
    }

    if (!tokens.size) {
      const fallback = this.getIndustryTerms(industry).split(' ').filter(Boolean);
      fallback.forEach((word) => tokens.add(word));
      fallback.forEach((word) => topical.add(word));
    }

    return { tokens: Array.from(tokens), topicalTokens: Array.from(topical) };
  }

  private static formatTokenForQuery(token: string): string | null {
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 2) return null;
    if (/^[-]+$/.test(trimmed)) return null;
    if (trimmed.startsWith('site:')) return null;
    if (trimmed.startsWith('-')) return null;
    return trimmed.toLowerCase();
  }

  private static buildLocationTokenSet(countryContext: CountryContext | null, country: string): Set<string> {
    const tokens = new Set<string>();
    if (countryContext) {
      countryContext.countryNames.forEach((name) => tokens.add(name.toLowerCase()));
      countryContext.cities.forEach((city) => tokens.add(city.toLowerCase()));
      if (countryContext.locationTokens) {
        countryContext.locationTokens.forEach((token) => tokens.add(token.toLowerCase()));
      }
    }
    if (country) {
      tokens.add(country.toLowerCase());
    }
    return tokens;
  }

  private static buildTimeframeTokens(from?: string, to?: string, locale?: string | null): string[] {
    const tokens: string[] = [];
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        tokens.push(`after ${fromDate.getFullYear()}`);
        tokens.push(fromDate.getFullYear().toString());
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        tokens.push(`before ${toDate.getFullYear()}`);
        if (!tokens.includes(toDate.getFullYear().toString())) {
          tokens.push(toDate.getFullYear().toString());
        }
      }
    }

    return tokens;
  }

  private static matchesTimeframeHint(content: string, timeframeTokens: string[]): boolean {
    if (!timeframeTokens.length) return false;
    const lower = content.toLowerCase();
    return timeframeTokens.some((token) => lower.includes(token.toLowerCase()));
  }

  private static deriveYear(from?: string, to?: string): string | null {
    const source = from ?? to;
    if (!source) return String(new Date().getFullYear());
    const parsed = new Date(source);
    if (Number.isNaN(parsed.getTime())) return null;
    return String(parsed.getFullYear());
  }

  /**
   * Map country code to Firecrawl location format
   */
  private static mapCountryToLocation(country: string): string {
    const locationMap: Record<string, string> = {
      "de": "Germany",
      "fr": "France", 
      "uk": "United Kingdom",
      "us": "United States",
      "nl": "Netherlands",
      "it": "Italy",
      "es": "Spain"
    };
    
    return locationMap[country.toLowerCase()] || "Germany";
  }

  /**
   * Build time-based search parameter
   */
  private static buildTimeBasedSearch(from?: string, to?: string): string {
    if (from && to) {
      // Custom date range format: cdr:1,cd_min:MM/DD/YYYY,cd_max:MM/DD/YYYY
      const fromDate = new Date(from);
      const toDate = new Date(to);
      
      // Allow future dates (e.g., 2025) for "next 30 days" type searches
      // Don't force dates to current year - let the user's date range stand
      
      const fromStr = `${(fromDate.getMonth() + 1).toString().padStart(2, '0')}/${fromDate.getDate().toString().padStart(2, '0')}/${fromDate.getFullYear()}`;
      const toStr = `${(toDate.getMonth() + 1).toString().padStart(2, '0')}/${toDate.getDate().toString().padStart(2, '0')}/${toDate.getFullYear()}`;
      return `cdr:1,cd_min:${fromStr},cd_max:${toStr}`;
    }
    return "qdr:y"; // Past year
  }

  /**
   * Extract date from markdown content
   */
  private static extractDateFromContent(markdown?: string | null): string | null {
    if (!markdown) return null;
    const datePatterns = [
      /(?:Date|Datum|When|Wann):\s*([^\n]+)/i,
      /(?:Event Date|Veranstaltungsdatum):\s*([^\n]+)/i,
      /(\d{4}-\d{2}-\d{2})/g,
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
      /(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{1,2},?\s+\d{4}/gi
    ];
    for (const pattern of datePatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return Array.isArray(match) ? match[0].trim() : null;
      }
    }
    return null;
  }

  private static isWithinRange(startISO: string | null, from?: string, to?: string): boolean {
    if (!startISO) return true;
    const eventDate = new Date(startISO);
    if (Number.isNaN(eventDate.getTime())) return true;
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime()) && eventDate < fromDate) {
        return false;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime()) && eventDate > toDate) {
        return false;
      }
    }
    return true;
  }

  /**
   * Extract location from markdown content
   */
  private static extractLocationFromContent(markdown?: string): string | null {
    if (!markdown) return null;
    
    // Look for location patterns
    const locationPatterns = [
      /(?:Location|Venue|Where):\s*([^\n]+)/i,
      /(?:Address):\s*([^\n]+)/i,
      /(?:City|Town):\s*([^\n]+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Extract organizer from markdown content
   */
  private static extractOrganizerFromContent(markdown?: string): string | null {
    if (!markdown) return null;
    
    // Look for organizer patterns
    const organizerPatterns = [
      /(?:Organizer|Host|Presented by):\s*([^\n]+)/i,
      /(?:Company|Organization):\s*([^\n]+)/i,
      /(?:Veranstalter|Organisator):\s*([^\n]+)/i
    ];
    
    for (const pattern of organizerPatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * Check if content is event-related
   */
  private static isEventRelated(content: string): boolean {
    const hasEventKeywords = EVENT_KEYWORDS.some(keyword => content.includes(keyword));
    
    // Also check for date patterns (events usually have dates)
    const hasDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(content);
    
    return hasEventKeywords || hasDatePattern;
  }

  /**
   * Calculate relevance score for search results
   */
  private static calculateRelevanceScore(content: string, date?: string | null, location?: string | null): number {
    let score = 0.5; // Base score
    
    // Higher score for having a date
    if (date) score += 0.2;
    
    // Higher score for having a location
    if (location) score += 0.2;
    
    // Higher score for event-specific keywords
    const keywordCount = EVENT_KEYWORDS.filter(keyword => content.includes(keyword)).length;
    score += Math.min(keywordCount * 0.1, 0.3);
    
    // Higher score for professional/industry terms
    const industryKeywords = ['legal', 'compliance', 'technology', 'business', 'professional'];
    const industryCount = industryKeywords.filter(keyword => content.includes(keyword)).length;
    score += Math.min(industryCount * 0.05, 0.2);
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Get industry-specific search terms
   */
  private static getIndustryTerms(industry: string): string {
    const industryMap: Record<string, string> = {
      "legal-compliance": "legal compliance investigation e-discovery regulatory governance risk management audit",
      "fintech": "fintech financial technology digital banking payments blockchain",
      "healthcare": "healthtech healthcare technology digital health medical technology",
      "general": "business professional development networking"
    };
    
    return industryMap[industry] || industryMap["general"];
  }

  /**
   * Get country-specific search terms
   */
  private static getCountryTerms(country: string): string {
    const countryMap: Record<string, string> = {
      "de": "Germany Deutschland",
      "fr": "France",
      "uk": "United Kingdom UK",
      "us": "United States USA",
      "nl": "Netherlands Nederland",
      "it": "Italy Italia",
      "es": "Spain España"
    };
    
    return countryMap[country.toLowerCase()] || "";
  }

  /**
   * Map country code to Firecrawl format
   */
  private static mapCountryCode(country: string): string {
    const countryMap: Record<string, string> = {
      "de": "DE",
      "fr": "FR", 
      "uk": "GB",
      "us": "US",
      "nl": "NL",
      "it": "IT",
      "es": "ES"
    };
    
    return countryMap[country.toLowerCase()] || "DE";
  }

  /**
   * Get language for country
   */
  private static getLanguageForCountry(country: string): string {
    const languageMap: Record<string, string> = {
      "de": "de",
      "fr": "fr",
      "uk": "en",
      "us": "en", 
      "nl": "nl",
      "it": "it",
      "es": "es"
    };
    
    return languageMap[country.toLowerCase()] || "en";
  }

  /**
   * Build time range for search
   */
  private static buildTimeRange(from?: string, to?: string): string {
    if (from && to) {
      return `${from} to ${to}`;
    }
    return "2025"; // Current year
  }

  /**
   * Get service health status
   */
  static async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    apiKeyConfigured: boolean;
    lastError?: string;
  }> {
    const apiKeyConfigured = !!process.env.FIRECRAWL_KEY;
    
    if (!apiKeyConfigured) {
      return {
        status: 'unhealthy',
        apiKeyConfigured: false,
        lastError: 'FIRECRAWL_KEY not configured'
      };
    }

    try {
      // Simple health check - just verify API key format
      const firecrawlKey = process.env.FIRECRAWL_KEY;
      
      if (!firecrawlKey) {
        return {
          status: 'unhealthy',
          apiKeyConfigured: false,
          lastError: 'FIRECRAWL_KEY not configured'
        };
      }
      
      // Basic validation - Firecrawl keys typically start with 'fc-'
      if (!firecrawlKey.startsWith('fc-')) {
        return {
          status: 'degraded',
          apiKeyConfigured: true,
          lastError: 'API key format may be incorrect'
        };
      }
      
      return {
        status: 'healthy',
        apiKeyConfigured: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        apiKeyConfigured: true,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static matchesCountry(hostname: string, location: string | undefined, countryIso: string): boolean {
    if (!countryIso) return true;
    const lowerHost = hostname.toLowerCase();
    const lowerCountry = countryIso.toLowerCase();

    if (lowerHost.endsWith(`.${lowerCountry}`)) {
      return true;
    }

    if (location) {
      const normalizedLocation = location.toLowerCase();
      if (normalizedLocation.includes(countryIso.toLowerCase())) {
        return true;
      }
      const context = getCountryContext(countryIso);
      if (context.countryNames.some((name) => normalizedLocation.includes(name.toLowerCase()))) {
        return true;
      }
      if (context.cities.some((city) => normalizedLocation.includes(city.toLowerCase()))) {
        return true;
      }
    }

    return false;
  }
}
