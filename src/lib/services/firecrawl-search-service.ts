import { RetryService } from "./retry-service";
import { buildSearchQuery } from '@/search/query';
import type { CountryContext } from '@/lib/utils/country';

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
  private static readonly SEARCH_TIMEOUT = 15000; // 15 seconds - faster fallback to Google CSE - very fast fallback

  /**
   * Execute a web search using Firecrawl Search API v2
   */
  static async searchEvents(params: FirecrawlSearchParams): Promise<FirecrawlSearchResult> {
    const { query, country = "", from, to, industry = "legal-compliance", maxResults = this.MAX_RESULTS, countryContext, locale, location } = params;
    
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_KEY not configured");
    }

    try {
      // Build the search query with event-specific terms
      const searchQuery = this.buildSearchQueryInternal(query, industry, country, from, to);
      
      // Build search parameters according to Firecrawl v2 API docs
      const searchParams = {
        query: searchQuery,
        limit: Math.min(maxResults, 20), // Reduce limit further to avoid timeouts
        sources: ["web"], // Focus on web results for events
        location: location || countryContext?.countryNames?.[0] || this.mapCountryToLocation(country),
        tbs: this.buildTimeBasedSearch(from, to),
        ignoreInvalidURLs: true,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: false, // Disable to reduce processing time
          waitFor: 500, // Reduce wait time
          blockAds: false, // Disable to reduce processing time
          removeBase64Images: false, // Disable to reduce processing time
          location: {
            country: countryContext?.iso2 || this.mapCountryCode(country),
            languages: [countryContext?.locale || locale || this.getLanguageForCountry(country)]
          }
        }
      };

      console.log(JSON.stringify({ 
        at: "firecrawl_call", 
        query: searchQuery, 
        params: searchParams 
      }));

      // Make the search request with retry logic
      const response = await RetryService.fetchWithRetry(
        "firecrawl",
        "search",
        this.FIRECRAWL_SEARCH_URL,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(searchParams),
          signal: AbortSignal.timeout(this.SEARCH_TIMEOUT)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl Search API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(JSON.stringify({ 
        at: "firecrawl_call_result", 
        status: response.status, 
        success: data.success,
        webResults: data.data?.web?.length || 0 
      }));

      // Transform Firecrawl results to our standard format with relevance filtering
      const items: SearchItem[] = [];
      
      if (data.success && data.data?.web) {
        for (const result of data.data.web) {
          // Filter out social media and other non-event domains
          const url = result.url || "";
          const hostname = new URL(url).hostname.toLowerCase();
          const socialMediaDomains = [
            "instagram.com", "www.instagram.com",
            "facebook.com", "www.facebook.com", 
            "twitter.com", "www.twitter.com", "x.com", "www.x.com",
            "linkedin.com", "www.linkedin.com",
            "youtube.com", "www.youtube.com",
            "tiktok.com", "www.tiktok.com",
            "reddit.com", "www.reddit.com"
          ];
          
          if (socialMediaDomains.includes(hostname)) {
            continue; // Skip social media results
          }
          
          // Filter for event-related content
          const content = (result.title + " " + result.description + " " + (result.markdown || "")).toLowerCase();
          const isEventRelated = this.isEventRelated(content);
          
          if (isEventRelated) {
            const extractedDate = this.extractDateFromContent(result.markdown);
            const extractedLocation = this.extractLocationFromContent(result.markdown);
            const extractedOrganizer = this.extractOrganizerFromContent(result.markdown);
            
            items.push({
              title: result.title || "Event",
              link: result.url || "",
              snippet: result.description || result.markdown?.substring(0, 200) || "",
              extractedData: {
                eventTitle: result.title,
                eventDate: extractedDate || undefined,
                location: extractedLocation || undefined,
                organizer: extractedOrganizer || undefined,
                confidence: this.calculateRelevanceScore(content, extractedDate, extractedLocation)
              }
            });
          }
        }
      }

      return {
        provider: "firecrawl",
        items: items.slice(0, maxResults),
        cached: false,
        searchMetadata: {
          totalResults: items.length,
          query: searchQuery
        }
      };

    } catch (error) {
      console.error('Firecrawl Search failed:', error);
      
      // If it's a timeout error, provide more specific information
      if (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
        console.warn('Firecrawl search timed out after 15 seconds - this is expected for complex queries');
      }
      
      throw error;
    }
  }

  /**
   * Build search query with event-specific terms
   */
  private static buildSearchQueryInternal(
    query: string, 
    industry: string, 
    country: string, 
    from?: string, 
    to?: string
  ): string {
    let searchQuery = query.trim();
    
    // Simplify: Use basic terms instead of complex boolean logic
    if (!searchQuery || searchQuery.length < 5) {
      const industryTerms = this.getIndustryTerms(industry);
      searchQuery = `${industryTerms} conference`;
    } else {
      // For legal/compliance, use specific event terms instead of complex boolean logic
      if (industry === 'legal-compliance') {
        // Use specific legal/compliance event terms that work well with Firecrawl
        searchQuery = 'legal compliance';
      } else {
        // Simplify complex queries to avoid Firecrawl timeouts
        // Extract key terms from complex boolean queries
        const keyTerms = searchQuery
          .replace(/\([^)]*\)/g, '') // Remove parentheses
          .replace(/\b(OR|AND)\b/gi, ' ') // Replace OR/AND with spaces
          .replace(/["']/g, '') // Remove quotes
          .split(/\s+/)
          .filter(term => term.length > 2)
          .slice(0, 5); // Take only first 5 terms
        
        if (keyTerms.length > 0) {
          searchQuery = keyTerms.join(' ');
        } else {
          searchQuery = 'business conference event';
        }
      }
      
      searchQuery = searchQuery
        .replace(/\s+/g, ' ') // Clean up multiple spaces
        .trim();
      
      // For Germany, make the query more specific to avoid international results
      if (country === 'de') {
        // Use German-specific compliance and legal terms
        const germanTerms = ['datenschutz', 'dsgvo', 'compliance', 'recht', 'legal', 'veranstaltung', 'kongress'];
        const hasGermanTerms = germanTerms.some(term => searchQuery.toLowerCase().includes(term));
        
        if (!hasGermanTerms) {
          // Replace generic terms with German equivalents
          searchQuery = searchQuery
            .replace(/\b(legal|compliance|investigation)\b/gi, 'compliance')
            .replace(/\b(conference|event|summit)\b/gi, 'veranstaltung');
          
          // Add German context
          searchQuery = `deutsche ${searchQuery} deutschland`;
        }
      }
      
      // Add event keywords if not present (English and German)
      const hasEventKeywords = ['conference', 'event', 'summit', 'veranstaltung', 'kongress', 'konferenz'].some(keyword => 
        searchQuery.toLowerCase().includes(keyword)
      );
      
      if (!hasEventKeywords) {
        // Add appropriate event keyword based on country
        if (country === 'de') {
          searchQuery += ' veranstaltung';
        } else {
          searchQuery += ' conference';
        }
      }
      
      // Add location specificity to reduce international results for all countries
      const countryNames: Record<string, string[]> = {
        de: ['germany', 'deutschland'],
        fr: ['france', 'french'],
        nl: ['netherlands', 'dutch', 'holland'],
        gb: ['uk', 'united kingdom', 'britain', 'british'],
        es: ['spain', 'spanish', 'españa'],
        it: ['italy', 'italian', 'italia'],
        se: ['sweden', 'swedish', 'sverige'],
        pl: ['poland', 'polish', 'polska'],
        be: ['belgium', 'belgian', 'belgique'],
        ch: ['switzerland', 'swiss', 'schweiz']
      };
      
      const names = countryNames[country] || [];
      const hasCountryName = names.some(name => searchQuery.toLowerCase().includes(name));
      
      if (!hasCountryName && country !== '') {
        // Add the primary country name to the search
        const primaryName = names[0] || country;
        searchQuery += ` ${primaryName}`;
      }
      
      // For Germany, add more specific location terms to reduce global results
      if (country === 'de') {
        // Add German city names to make search more specific
        const germanCities = ['berlin', 'munich', 'hamburg', 'cologne', 'frankfurt', 'stuttgart'];
        const hasGermanCity = germanCities.some(city => searchQuery.toLowerCase().includes(city));
        
        if (!hasGermanCity) {
          // Add a major German city to focus the search
          searchQuery += ' berlin';
        }
        
        // Add German-specific event terms to find local events
        const germanEventTerms = ['deutschland', 'deutsche', 'german', 'veranstaltung', 'kongress', 'konferenz', 'workshop', 'panel', 'summit'];
        const hasGermanEventTerm = germanEventTerms.some(term => searchQuery.toLowerCase().includes(term));
        
        if (!hasGermanEventTerm) {
          // Add multiple German event types
          searchQuery += ' (veranstaltung OR konferenz OR kongress OR workshop)';
        }
      }
    }

    // Add current year instead of 2025
    const currentYear = new Date().getFullYear();
    searchQuery += ` ${currentYear}`;

    // Add country-specific terms (simplified)
    if (country) {
      const countryTerms = this.getCountryTerms(country);
      if (countryTerms) {
        searchQuery += ` ${countryTerms.split(' ')[0]}`; // Just use first country term
      }
    }

    // Use the centralized query builder instead
    const baseQuery = searchQuery || this.getIndustryTerms(industry);
    return buildSearchQuery({ 
      baseQuery,
      userText: undefined
    });
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
  private static extractDateFromContent(markdown?: string): string | null {
    if (!markdown) return null;
    
    // Look for common date patterns (more comprehensive)
    const datePatterns = [
      // MM/DD/YYYY or DD/MM/YYYY
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      // YYYY-MM-DD
      /(\d{4}-\d{2}-\d{2})/g,
      // Full month names
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
      // Abbreviated month names
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/gi,
      // German month names
      /(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{1,2},?\s+\d{4}/gi,
      // Event-specific date patterns
      /(?:Date|Datum|When|Wann):\s*([^\n]+)/i,
      /(?:Event Date|Veranstaltungsdatum):\s*([^\n]+)/i,
      // Look for dates near event keywords
      /(?:conference|event|summit|workshop).*?(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/gi
    ];
    
    for (const pattern of datePatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
    
    return null;
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
    const eventKeywords = [
      // English event keywords
      'conference', 'summit', 'event', 'workshop', 'seminar', 'exhibition',
      'trade show', 'convention', 'symposium', 'meeting', 'gathering',
      'forum', 'expo', 'showcase', 'networking', 'training', 'webinar',
      // German event keywords
      'veranstaltung', 'kongress', 'fachkonferenz', 'fachkongress',
      'tagung', 'messe', 'ausstellung', 'seminar', 'workshop',
      'netzwerk', 'treffen', 'event', 'konferenz', 'symposium',
      'fachmesse', 'handelsmesse', 'veranstaltungsreihe', 'fortbildung'
    ];
    
    const hasEventKeywords = eventKeywords.some(keyword => 
      content.includes(keyword)
    );
    
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
    const eventKeywords = ['conference', 'summit', 'event', 'workshop', 'seminar'];
    const keywordCount = eventKeywords.filter(keyword => content.includes(keyword)).length;
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
    
    return industryMap[industry] || industryMap["legal-compliance"];
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
}
