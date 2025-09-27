/**
 * Enhanced Firecrawl Service with Timeout Handling
 * 
 * This module provides enhanced Firecrawl integration with improved timeout handling,
 * batch processing, and fallback strategies.
 */

import { SEARCH_THRESHOLDS } from '@/config/search-legal-de';

export interface FirecrawlSearchOptions {
  query: string;
  sources: string[];
  location: string;
  tbs: string;
  scrapeOptions: {
    location: { country: string; languages: string[] };
    ignoreInvalidURLs: boolean;
  };
  maxResults?: number;
}

export interface FirecrawlExtractOptions {
  url: string;
  formats: string[];
  maxPollMs?: number;
  batchSize?: number;
}

export interface ExtractResult {
  success: boolean;
  content?: string;
  error?: string;
  polledAttempts: number;
  timedOut: boolean;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet?: string;
}

/**
 * Enhanced Firecrawl service with timeout handling
 */
export class EnhancedFirecrawlService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.firecrawl.dev/v1';
  }

  /**
   * Performs search with enhanced error handling
   */
  async search(options: FirecrawlSearchOptions): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Firecrawl search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.webResults || data.webResults.length === 0) {
        console.warn('No web results from Firecrawl search');
        return [];
      }

      return data.webResults.map((result: any) => ({
        url: result.url,
        title: result.title || '',
        snippet: result.snippet || ''
      }));

    } catch (error) {
      console.error('Firecrawl search error:', error);
      return [];
    }
  }

  /**
   * Extracts content with timeout handling and fallback
   */
  async extractContent(
    urls: string[],
    options: Partial<FirecrawlExtractOptions> = {}
  ): Promise<Map<string, ExtractResult>> {
    const {
      formats = ['markdown', 'html'],
      maxPollMs = SEARCH_THRESHOLDS.MAX_POLL_MS,
      batchSize = SEARCH_THRESHOLDS.MAX_BATCH_SIZE
    } = options;

    const results = new Map<string, ExtractResult>();
    
    // Process URLs in batches
    const batches = this.chunkArray(urls, batchSize);
    
    for (const batch of batches) {
      console.log(`Processing batch of ${batch.length} URLs`);
      
      const batchResults = await Promise.allSettled(
        batch.map(url => this.extractSingleUrl(url, formats, maxPollMs))
      );

      batchResults.forEach((result, index) => {
        const url = batch[index];
        if (result.status === 'fulfilled') {
          results.set(url, result.value);
        } else {
          results.set(url, {
            success: false,
            error: result.reason?.message || 'Unknown error',
            polledAttempts: 0,
            timedOut: false
          });
        }
      });
    }

    return results;
  }

  /**
   * Extracts content from a single URL with timeout handling
   */
  private async extractSingleUrl(
    url: string,
    formats: string[],
    maxPollMs: number
  ): Promise<ExtractResult> {
    try {
      // Check if URL is too large or has too many links (likely index page)
      const sizeCheck = await this.checkUrlSize(url);
      if (!sizeCheck.suitable) {
        return {
          success: false,
          error: sizeCheck.reason,
          polledAttempts: 0,
          timedOut: false
        };
      }

      // Start extraction
      const extractResponse = await fetch(`${this.baseUrl}/extract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats,
          ignoreInvalidURLs: true
        }),
      });

      if (!extractResponse.ok) {
        throw new Error(`Extract request failed: ${extractResponse.status}`);
      }

      const extractData = await extractResponse.json();
      
      if (!extractData.jobId) {
        throw new Error('No job ID returned from extract request');
      }

      // Poll for completion with timeout
      const result = await this.pollForCompletion(extractData.jobId, maxPollMs);
      
      if (result.timedOut) {
        // Fallback to scrape
        console.warn(`Extract timed out for ${url}, falling back to scrape`);
        return await this.fallbackToScrape(url, formats);
      }

      return result;

    } catch (error) {
      console.error(`Error extracting ${url}:`, error);
      
      // Fallback to scrape
      try {
        return await this.fallbackToScrape(url, formats);
      } catch (fallbackError) {
        return {
          success: false,
          error: `Extract failed: ${error.message}. Fallback failed: ${fallbackError.message}`,
          polledAttempts: 0,
          timedOut: false
        };
      }
    }
  }

  /**
   * Polls for extraction completion with timeout
   */
  private async pollForCompletion(jobId: string, maxPollMs: number): Promise<ExtractResult> {
    const startTime = Date.now();
    let polledAttempts = 0;
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxPollMs) {
      try {
        const response = await fetch(`${this.baseUrl}/extract/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Poll request failed: ${response.status}`);
        }

        const data = await response.json();
        polledAttempts++;

        if (data.status === 'completed') {
          return {
            success: true,
            content: data.data?.markdown || data.data?.html || '',
            polledAttempts,
            timedOut: false
          };
        }

        if (data.status === 'failed') {
          return {
            success: false,
            error: data.error || 'Extraction failed',
            polledAttempts,
            timedOut: false
          };
        }

        // Still processing, wait and continue
        await this.delay(pollInterval);

      } catch (error) {
        console.error(`Error polling job ${jobId}:`, error);
        await this.delay(pollInterval);
      }
    }

    return {
      success: false,
      error: 'Polling timeout',
      polledAttempts,
      timedOut: true
    };
  }

  /**
   * Fallback to scrape when extract fails
   */
  private async fallbackToScrape(url: string, formats: string[]): Promise<ExtractResult> {
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats,
          ignoreInvalidURLs: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Scrape request failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.data?.markdown || data.data?.html || '',
        polledAttempts: 0,
        timedOut: false
      };

    } catch (error) {
      return {
        success: false,
        error: `Scrape fallback failed: ${error.message}`,
        polledAttempts: 0,
        timedOut: false
      };
    }
  }

  /**
   * Checks if URL is suitable for extraction
   */
  private async checkUrlSize(url: string): Promise<{ suitable: boolean; reason?: string }> {
    try {
      // Simple heuristic checks
      if (url.includes('index') || url.includes('category') || url.includes('archive')) {
        return { suitable: false, reason: 'likely index page' };
      }

      // Could add more sophisticated checks here
      // For now, assume all URLs are suitable
      return { suitable: true };

    } catch (error) {
      return { suitable: false, reason: 'size check failed' };
    }
  }

  /**
   * Utility to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
