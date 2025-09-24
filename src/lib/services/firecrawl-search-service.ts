import { RetryService } from "./retry-service";

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
  private static readonly SEARCH_TIMEOUT = 60000; // 60 seconds (as per docs)

  /**
   * Execute a web search using Firecrawl Search API v2
   */
  static async searchEvents(params: FirecrawlSearchParams): Promise<FirecrawlSearchResult> {
    const { query, country = "", from, to, industry = "legal-compliance", maxResults = this.MAX_RESULTS } = params;
    
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_KEY not configured");
    }

    try {
      // Build the search query with event-specific terms
      const searchQuery = this.buildSearchQuery(query, industry, country, from, to);
      
      // Build search parameters according to Firecrawl v2 API docs
      const searchParams = {
        query: searchQuery,
        limit: Math.min(maxResults, 100), // Firecrawl limit is 100
        sources: ["web"], // Focus on web results for events
        location: this.mapCountryToLocation(country),
        tbs: this.buildTimeBasedSearch(from, to),
        timeout: this.SEARCH_TIMEOUT,
        ignoreInvalidURLs: true,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 2000,
          blockAds: true,
          removeBase64Images: true,
          location: {
            country: this.mapCountryCode(country),
            languages: [this.getLanguageForCountry(country)]
          }
        }
      };

      console.log(JSON.stringify({ 
        at: "firecrawl_search", 
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
        at: "firecrawl_search_result", 
        status: response.status, 
        success: data.success,
        webResults: data.data?.web?.length || 0 
      }));

      // Transform Firecrawl results to our standard format
      const items: SearchItem[] = [];
      
      if (data.success && data.data?.web) {
        for (const result of data.data.web) {
          items.push({
            title: result.title || "Event",
            link: result.url || "",
            snippet: result.description || result.markdown?.substring(0, 200) || "",
            extractedData: {
              eventTitle: result.title,
              eventDate: this.extractDateFromContent(result.markdown),
              location: this.extractLocationFromContent(result.markdown),
              organizer: this.extractOrganizerFromContent(result.markdown),
              confidence: 0.8
            }
          });
        }
      }

      return {
        provider: "firecrawl",
        items: items.slice(0, maxResults),
        cached: false,
        searchMetadata: {
          totalResults: items.length,
          query: searchQuery,
          warning: data.warning
        }
      };

    } catch (error) {
      console.error('Firecrawl Search failed:', error);
      throw error;
    }
  }

  /**
   * Build search query with event-specific terms
   */
  private static buildSearchQuery(
    query: string, 
    industry: string, 
    country: string, 
    from?: string, 
    to?: string
  ): string {
    let searchQuery = query.trim();
    
    // Add industry-specific terms if query is empty or basic
    if (!searchQuery || searchQuery.length < 10) {
      const industryTerms = this.getIndustryTerms(industry);
      searchQuery = `${industryTerms} conference summit event`;
    }

    // Add event-specific keywords using Firecrawl query operators
    const eventKeywords = [
      "conference", "summit", "forum", "workshop", "seminar", 
      "exhibition", "trade show", "convention", "symposium"
    ];
    
    // Check if event keywords are already present
    const hasEventKeywords = eventKeywords.some(keyword => 
      searchQuery.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasEventKeywords) {
      searchQuery += ` (conference OR summit OR event)`;
    }

    // Add date range if specified
    if (from && to) {
      searchQuery += ` ${from} ${to} 2025`;
    } else {
      searchQuery += ` 2025`;
    }

    // Add country-specific terms
    if (country) {
      const countryTerms = this.getCountryTerms(country);
      if (countryTerms) {
        searchQuery += ` ${countryTerms}`;
      }
    }

    return searchQuery;
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
    
    // Look for common date patterns
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,
      /(\d{4}-\d{2}-\d{2})/g,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi
    ];
    
    for (const pattern of datePatterns) {
      const match = markdown.match(pattern);
      if (match) {
        return match[0];
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
      /(?:Company|Organization):\s*([^\n]+)/i
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
    return "2025";
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
