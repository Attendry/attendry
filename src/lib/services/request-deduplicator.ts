/**
 * Request Deduplication Service
 * 
 * This service prevents duplicate API calls to external services by
 * tracking ongoing requests and returning the same promise for identical requests.
 */

/**
 * Request fingerprint for deduplication
 */
interface RequestFingerprint {
  service: string;
  endpoint: string;
  method: string;
  params: Record<string, any>;
  headers?: Record<string, string>;
}

/**
 * Ongoing request tracking
 */
interface OngoingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
  requestId: string;
}

/**
 * Request deduplication service
 */
export class RequestDeduplicator {
  private ongoingRequests = new Map<string, OngoingRequest>();
  private readonly REQUEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Generate a unique fingerprint for a request
   */
  private generateFingerprint(request: RequestFingerprint): string {
    const normalizedParams = this.normalizeParams(request.params);
    const normalizedHeaders = this.normalizeHeaders(request.headers);
    
    const fingerprint = {
      service: request.service,
      endpoint: request.endpoint,
      method: request.method.toUpperCase(),
      params: normalizedParams,
      headers: normalizedHeaders,
    };

    return JSON.stringify(fingerprint);
  }

  /**
   * Normalize parameters for consistent fingerprinting
   */
  private normalizeParams(params: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        continue;
      }
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        normalized[key] = this.normalizeParams(value);
      } else if (Array.isArray(value)) {
        normalized[key] = value.sort();
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  /**
   * Normalize headers for consistent fingerprinting
   */
  private normalizeHeaders(headers?: Record<string, string>): Record<string, string> {
    if (!headers) return {};
    
    const normalized: Record<string, string> = {};
    
    // Only include relevant headers for deduplication
    const relevantHeaders = ['authorization', 'content-type', 'accept', 'user-agent'];
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (relevantHeaders.includes(lowerKey)) {
        normalized[lowerKey] = value;
      }
    }
    
    return normalized;
  }

  /**
   * Deduplicate a request
   */
  async deduplicate<T>(
    request: RequestFingerprint,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const fingerprint = this.generateFingerprint(request);
    const now = Date.now();

    // Check if there's an ongoing request with the same fingerprint
    const ongoingRequest = this.ongoingRequests.get(fingerprint);
    
    if (ongoingRequest) {
      // Check if the request is still valid (not timed out)
      if (now - ongoingRequest.timestamp < this.REQUEST_TIMEOUT) {
        console.log(`[DEDUP] Reusing ongoing request for ${request.service}:${request.endpoint}`);
        return ongoingRequest.promise;
      } else {
        // Remove timed out request
        this.ongoingRequests.delete(fingerprint);
      }
    }

    // Create new request
    const requestId = this.generateRequestId();
    console.log(`[DEDUP] Starting new request for ${request.service}:${request.endpoint} (ID: ${requestId})`);
    
    const promise = this.executeRequest(requestFn, fingerprint, requestId);
    
    // Store the ongoing request
    this.ongoingRequests.set(fingerprint, {
      promise,
      timestamp: now,
      requestId,
    });

    return promise;
  }

  /**
   * Execute the actual request with cleanup
   */
  private async executeRequest<T>(
    requestFn: () => Promise<T>,
    fingerprint: string,
    requestId: string
  ): Promise<T> {
    try {
      const result = await requestFn();
      console.log(`[DEDUP] Request completed for ${requestId}`);
      return result;
    } catch (error) {
      console.error(`[DEDUP] Request failed for ${requestId}:`, error);
      throw error;
    } finally {
      // Remove the request from ongoing requests
      this.ongoingRequests.delete(fingerprint);
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup timer to remove stale requests
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleRequests();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up stale requests
   */
  private cleanupStaleRequests(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [fingerprint, request] of this.ongoingRequests.entries()) {
      if (now - request.timestamp > this.REQUEST_TIMEOUT) {
        this.ongoingRequests.delete(fingerprint);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[DEDUP] Cleaned up ${cleanedCount} stale requests`);
    }
  }

  /**
   * Get statistics about ongoing requests
   */
  getStats(): {
    ongoingRequests: number;
    requests: Array<{
      fingerprint: string;
      requestId: string;
      age: number;
    }>;
  } {
    const now = Date.now();
    const requests = Array.from(this.ongoingRequests.entries()).map(([fingerprint, request]) => ({
      fingerprint,
      requestId: request.requestId,
      age: now - request.timestamp,
    }));

    return {
      ongoingRequests: this.ongoingRequests.size,
      requests,
    };
  }

  /**
   * Clear all ongoing requests
   */
  clearAll(): void {
    this.ongoingRequests.clear();
    console.log('[DEDUP] Cleared all ongoing requests');
  }

  /**
   * Stop the cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clearAll();
  }
}

/**
 * Global request deduplicator instance
 */
let globalDeduplicator: RequestDeduplicator | null = null;

/**
 * Get or create global request deduplicator
 */
export function getRequestDeduplicator(): RequestDeduplicator {
  if (!globalDeduplicator) {
    globalDeduplicator = new RequestDeduplicator();
  }
  return globalDeduplicator;
}

/**
 * Deduplicate a request using the global deduplicator
 */
export async function deduplicateRequest<T>(
  request: RequestFingerprint,
  requestFn: () => Promise<T>
): Promise<T> {
  const deduplicator = getRequestDeduplicator();
  return deduplicator.deduplicate(request, requestFn);
}

/**
 * Helper function to create request fingerprint for HTTP requests
 */
export function createHttpRequestFingerprint(
  service: string,
  url: string,
  method: string = 'GET',
  params: Record<string, any> = {},
  headers: Record<string, string> = {}
): RequestFingerprint {
  return {
    service,
    endpoint: url,
    method,
    params,
    headers,
  };
}

/**
 * Helper function to create request fingerprint for API calls
 */
export function createApiRequestFingerprint(
  service: string,
  endpoint: string,
  method: string = 'GET',
  body: any = null,
  queryParams: Record<string, any> = {},
  headers: Record<string, string> = {}
): RequestFingerprint {
  const params: Record<string, any> = { ...queryParams };
  
  if (body) {
    params.body = body;
  }

  return {
    service,
    endpoint,
    method,
    params,
    headers,
  };
}
