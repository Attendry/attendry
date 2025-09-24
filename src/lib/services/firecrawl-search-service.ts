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
  private static readonly FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v1/search";
  private static readonly MAX_RESULTS = 20;
  private static readonly SEARCH_TIMEOUT = 30000; // 30 seconds

  /**
   * Execute a web search using Firecrawl Search API
   */
  static async searchEvents(params: FirecrawlSearchParams): Promise<FirecrawlSearchResult> {
    const { query, country = "", from, to, industry = "legal-compliance", maxResults = this.MAX_RESULTS } = params;
    
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_KEY not configured");
    }

    try {
      // Build the search prompt based on industry and parameters
      const searchPrompt = this.buildSearchPrompt(query, country, from, to, industry);
      
      // Build search parameters
      const searchParams = {
        query: searchPrompt,
        numResults: Math.min(maxResults, 20), // Firecrawl limit
        country: this.mapCountryCode(country),
        language: this.getLanguageForCountry(country),
        timeRange: this.buildTimeRange(from, to),
        searchOptions: {
          includeHtml: false,
          includeMarkdown: true,
          onlyMainContent: true
        }
      };

      console.log(JSON.stringify({ 
        at: "firecrawl_search", 
        query: searchPrompt, 
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
        results: data.results?.length || 0 
      }));

      // Transform Firecrawl results to our standard format
      const items: SearchItem[] = (data.results || []).map((result: any) => ({
        title: result.title || result.url,
        link: result.url || "",
        snippet: result.snippet || result.description || "",
        extractedData: {
          eventTitle: result.title,
          eventDate: result.eventDate,
          location: result.location,
          organizer: result.organizer,
          confidence: result.confidence || 0.8
        }
      }));

      return {
        provider: "firecrawl",
        items,
        cached: false,
        searchMetadata: {
          totalResults: data.totalResults || items.length,
          searchTime: data.searchTime,
          query: searchPrompt
        }
      };

    } catch (error) {
      console.error('Firecrawl Search failed:', error);
      throw error;
    }
  }

  /**
   * Build a comprehensive search prompt for event discovery
   */
  private static buildSearchPrompt(
    query: string, 
    country: string, 
    from?: string, 
    to?: string, 
    industry: string = "legal-compliance"
  ): string {
    let prompt = query.trim();
    
    // Add industry-specific terms if query is empty or basic
    if (!prompt || prompt.length < 10) {
      const industryTerms = this.getIndustryTerms(industry);
      prompt = `${industryTerms} conference summit event`;
    }

    // Add event-specific keywords
    const eventKeywords = [
      "conference", "summit", "forum", "workshop", "seminar", 
      "exhibition", "trade show", "convention", "symposium",
      "veranstaltung", "kongress", "fachkonferenz", "fachkongress"
    ];
    
    // Check if event keywords are already present
    const hasEventKeywords = eventKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasEventKeywords) {
      prompt += " conference summit event";
    }

    // Add date range if specified
    if (from && to) {
      prompt += ` ${from} ${to} 2025`;
    } else {
      prompt += " 2025";
    }

    // Add country-specific terms
    if (country) {
      const countryTerms = this.getCountryTerms(country);
      if (countryTerms) {
        prompt += ` ${countryTerms}`;
      }
    }

    return prompt;
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
      // Test with a simple search
      await this.searchEvents({
        query: "test conference 2025",
        maxResults: 1
      });
      
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
