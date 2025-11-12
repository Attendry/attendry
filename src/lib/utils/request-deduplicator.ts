/**
 * Request De-duplication for Firecrawl API calls
 * Prevents duplicate in-flight requests and caches recent results
 */

interface RequestFingerprint {
  query: string;
  location?: string | null;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  sources: string[];
}

interface CachedResult<T> {
  data: T;
  timestamp: number;
}

type InFlightRequest<T> = Promise<T>;

export class RequestDeduplicator<T = any> {
  private inFlight = new Map<string, InFlightRequest<T>>();
  private recentResults = new Map<string, CachedResult<T>>();
  
  private readonly IN_FLIGHT_TTL = 10000; // 10s
  private readonly CACHE_TTL = 60000; // 60s
  
  /**
   * Generate fingerprint hash from request parameters
   */
  private fingerprint(params: RequestFingerprint): string {
    const normalized = {
      query: params.query.trim().toLowerCase(),
      location: params.location?.trim().toLowerCase() || '',
      dateFrom: params.dateFrom || '',
      dateTo: params.dateTo || '',
      limit: params.limit,
      sources: [...params.sources].sort().join(',')
    };
    
    return JSON.stringify(normalized);
  }
  
  /**
   * Execute request with de-duplication
   * - Returns cached result if fresh
   * - Awaits in-flight request if duplicate
   * - Executes new request otherwise
   */
  async execute(
    params: RequestFingerprint,
    executor: () => Promise<T>
  ): Promise<T> {
    const key = this.fingerprint(params);
    const now = Date.now();
    
    // 1. Check recent cache
    const cached = this.recentResults.get(key);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      console.log('[request-deduplicator] Cache HIT for:', params.query.substring(0, 50));
      return cached.data;
    }
    
    // 2. Check in-flight
    const inflight = this.inFlight.get(key);
    if (inflight) {
      console.log('[request-deduplicator] Awaiting in-flight request for:', params.query.substring(0, 50));
      return await inflight;
    }
    
    // 3. Execute new request
    console.log('[request-deduplicator] Executing NEW request for:', params.query.substring(0, 50));
    
    const promise = executor()
      .then(result => {
        // Cache result
        this.recentResults.set(key, { data: result, timestamp: Date.now() });
        
        // Clean up in-flight
        this.inFlight.delete(key);
        
        // Schedule cache cleanup
        setTimeout(() => {
          const entry = this.recentResults.get(key);
          if (entry && (Date.now() - entry.timestamp) >= this.CACHE_TTL) {
            this.recentResults.delete(key);
          }
        }, this.CACHE_TTL);
        
        return result;
      })
      .catch(error => {
        // Clean up in-flight on error
        this.inFlight.delete(key);
        throw error;
      });
    
    this.inFlight.set(key, promise);
    
    return await promise;
  }
  
  /**
   * Clear all caches (for testing)
   */
  clear(): void {
    this.inFlight.clear();
    this.recentResults.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      inFlight: this.inFlight.size,
      cached: this.recentResults.size
    };
  }
}

// Singleton instance for Firecrawl requests
export const firecrawlDeduplicator = new RequestDeduplicator();

