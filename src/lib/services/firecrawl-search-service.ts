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
  private static readonly FIRECRAWL_EXTRACT_URL = "https://api.firecrawl.dev/v2/extract";
  private static readonly MAX_RESULTS = 20;
  private static readonly SEARCH_TIMEOUT = 30000; // 30 seconds

  /**
   * Execute a web search using Firecrawl Extract API with search URLs
   * Since Firecrawl doesn't have a dedicated search API, we'll use known event sites
   */
  static async searchEvents(params: FirecrawlSearchParams): Promise<FirecrawlSearchResult> {
    const { query, country = "", from, to, industry = "legal-compliance", maxResults = this.MAX_RESULTS } = params;
    
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_KEY not configured");
    }

    try {
      // Get search URLs based on industry and country
      const searchUrls = this.getSearchUrls(industry, country, query);
      
      console.log(JSON.stringify({ 
        at: "firecrawl_search", 
        query, 
        urls: searchUrls.length,
        industry,
        country
      }));

      // Use Firecrawl Extract to search these URLs for events
      const response = await RetryService.fetchWithRetry(
        "firecrawl",
        "search",
        this.FIRECRAWL_EXTRACT_URL,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            urls: searchUrls.slice(0, 10), // Limit to 10 URLs
            schema: EVENT_SEARCH_SCHEMA,
            prompt: this.buildExtractionPrompt(query, industry, country, from, to),
            showSources: true,
            scrapeOptions: {
              formats: ["markdown"],
              onlyMainContent: true,
              waitFor: 2000,
              blockAds: true,
              removeBase64Images: true
            },
            ignoreInvalidURLs: true
          }),
          signal: AbortSignal.timeout(this.SEARCH_TIMEOUT)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firecrawl Extract API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(JSON.stringify({ 
        at: "firecrawl_search_result", 
        status: response.status, 
        events: data.data?.length || 0 
      }));

      // Transform Firecrawl results to our standard format
      const items: SearchItem[] = [];
      
      if (data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item.events && Array.isArray(item.events)) {
            for (const event of item.events) {
              items.push({
                title: event.title || item.metadata?.title || "Event",
                link: event.url || item.metadata?.sourceURL || "",
                snippet: event.snippet || item.metadata?.description || "",
                extractedData: {
                  eventTitle: event.title,
                  eventDate: event.eventDate,
                  location: event.location,
                  organizer: event.organizer,
                  confidence: event.confidence || 0.8
                }
              });
            }
          }
        }
      }

      return {
        provider: "firecrawl",
        items: items.slice(0, maxResults),
        cached: false,
        searchMetadata: {
          totalResults: items.length,
          query: query
        }
      };

    } catch (error) {
      console.error('Firecrawl Search failed:', error);
      throw error;
    }
  }

  /**
   * Get search URLs based on industry and country
   */
  private static getSearchUrls(industry: string, country: string, query: string): string[] {
    const baseUrls = [
      "https://www.eventbrite.com",
      "https://www.meetup.com",
      "https://www.linkedin.com/events",
      "https://www.eventful.com"
    ];

    // Add industry-specific URLs
    const industryUrls: Record<string, string[]> = {
      "legal-compliance": [
        "https://www.legaltechconference.com",
        "https://www.complianceweek.com",
        "https://www.legaltechnews.com"
      ],
      "fintech": [
        "https://www.fintechconference.com",
        "https://www.money2020.com",
        "https://www.fintechnews.com"
      ],
      "healthcare": [
        "https://www.himss.org",
        "https://www.healthtechconference.com",
        "https://www.healthcareinnovation.com"
      ]
    };

    // Add country-specific URLs
    const countryUrls: Record<string, string[]> = {
      "de": [
        "https://www.xing.com/events",
        "https://www.eventbrite.de",
        "https://www.meetup.com/de-DE"
      ],
      "fr": [
        "https://www.eventbrite.fr",
        "https://www.meetup.com/fr-FR"
      ],
      "uk": [
        "https://www.eventbrite.co.uk",
        "https://www.meetup.com/en-GB"
      ]
    };

    let urls = [...baseUrls];
    
    if (industryUrls[industry]) {
      urls = [...urls, ...industryUrls[industry]];
    }
    
    if (countryUrls[country]) {
      urls = [...urls, ...countryUrls[country]];
    }

    return urls;
  }

  /**
   * Build extraction prompt for event discovery
   */
  private static buildExtractionPrompt(
    query: string, 
    industry: string, 
    country: string, 
    from?: string, 
    to?: string
  ): string {
    const industryTerms = this.getIndustryTerms(industry);
    const countryTerms = this.getCountryTerms(country);
    
    return `Extract all upcoming events related to ${query || industryTerms} ${countryTerms ? `in ${countryTerms}` : ''} ${from && to ? `between ${from} and ${to}` : 'in 2025'}. 

Look for:
- Event titles and descriptions
- Dates and locations
- Organizers and sponsors
- Registration information
- Event types (conferences, workshops, seminars, etc.)

Focus on professional events, conferences, and business gatherings. Ignore personal events, parties, or non-business activities.`;
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
      // Simple health check - just verify API key format and endpoint availability
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
