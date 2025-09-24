import { NextRequest, NextResponse } from "next/server";
import { GeminiService } from "@/lib/services/gemini-service";
import { RetryService } from "@/lib/services/retry-service";
import { FirecrawlSearchService } from "@/lib/services/firecrawl-search-service";

/**
 * Health Check API Route
 * 
 * Provides comprehensive health status for all external dependencies
 * including Google CSE, Firecrawl, Gemini AI, and internal services.
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    google_cse: ServiceHealth;
    firecrawl: ServiceHealth;
    firecrawl_search: ServiceHealth;
    gemini: ServiceHealth;
    database: ServiceHealth;
    retry_service: ServiceHealth;
  };
  metrics: {
    retry_attempts: number;
    retry_failures: number;
    cache_hits: number;
    cache_misses: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms?: number;
  last_error?: string;
  details?: any;
}

/**
 * GET /api/health
 * 
 * Returns comprehensive health status for all services
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Check all services in parallel for better performance
    const [
      geminiHealth,
      firecrawlSearchHealth,
      retryMetrics,
      databaseHealth
    ] = await Promise.allSettled([
      checkGeminiHealth(),
      checkFirecrawlSearchHealth(),
      getRetryMetrics(),
      checkDatabaseHealth()
    ]);

    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        google_cse: await checkGoogleCSEHealth(),
        firecrawl: await checkFirecrawlHealth(),
        firecrawl_search: firecrawlSearchHealth.status === 'fulfilled' ? firecrawlSearchHealth.value : {
          status: 'unhealthy',
          last_error: firecrawlSearchHealth.status === 'rejected' ? firecrawlSearchHealth.reason?.message : 'Unknown error'
        },
        gemini: geminiHealth.status === 'fulfilled' ? geminiHealth.value : {
          status: 'unhealthy',
          last_error: geminiHealth.status === 'rejected' ? geminiHealth.reason?.message : 'Unknown error'
        },
        database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : {
          status: 'unhealthy',
          last_error: databaseHealth.status === 'rejected' ? databaseHealth.reason?.message : 'Unknown error'
        },
        retry_service: {
          status: 'healthy',
          details: retryMetrics.status === 'fulfilled' ? retryMetrics.value : {}
        }
      },
      metrics: {
        retry_attempts: 0,
        retry_failures: 0,
        cache_hits: 0,
        cache_misses: 0
      }
    };

    // Calculate overall status
    const serviceStatuses = Object.values(healthStatus.services).map(s => s.status);
    if (serviceStatuses.includes('unhealthy')) {
      healthStatus.status = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      healthStatus.status = 'degraded';
    }

    // Add retry metrics if available
    if (retryMetrics.status === 'fulfilled') {
      const metrics = retryMetrics.value;
      healthStatus.metrics.retry_attempts = Array.from(metrics.values())
        .reduce((sum, m) => sum + m.totalAttempts, 0);
      healthStatus.metrics.retry_failures = Array.from(metrics.values())
        .reduce((sum, m) => sum + m.totalFailures, 0);
    } else {
      // Set default values if metrics are not available
      healthStatus.metrics.retry_attempts = 0;
      healthStatus.metrics.retry_failures = 0;
    }

    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      ...healthStatus,
      response_time_ms: responseTime
    }, { 
      status: healthStatus.status === 'unhealthy' ? 503 : 200 
    });

  } catch (error) {
    console.error("Health check failed:", error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      response_time_ms: Date.now() - startTime
    }, { status: 503 });
  }
}

/**
 * Check Google CSE API health
 */
async function checkGoogleCSEHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const key = process.env.GOOGLE_CSE_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    
    if (!key || !cx) {
      return {
        status: 'unhealthy',
        last_error: 'GOOGLE_CSE_KEY or GOOGLE_CSE_CX not configured'
      };
    }

    // Test with a simple search
    const testUrl = `https://www.googleapis.com/customsearch/v1?q=test&key=${key}&cx=${cx}&num=1`;
    
    const response = await fetch(testUrl, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: 'healthy',
        response_time_ms: responseTime
      };
    } else {
      return {
        status: 'unhealthy',
        response_time_ms: responseTime,
        last_error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      last_error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check Firecrawl API health
 */
async function checkFirecrawlHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const firecrawlKey = process.env.FIRECRAWL_KEY;
    
    if (!firecrawlKey) {
      return {
        status: 'unhealthy',
        last_error: 'FIRECRAWL_KEY not configured'
      };
    }

    // Test with a simple scrape request
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://example.com',
        formats: ['markdown'],
        onlyMainContent: true
      }),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      return {
        status: 'healthy',
        response_time_ms: responseTime
      };
    } else {
      return {
        status: 'unhealthy',
        response_time_ms: responseTime,
        last_error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      last_error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check Firecrawl Search API health
 */
async function checkFirecrawlSearchHealth(): Promise<ServiceHealth> {
  try {
    return await FirecrawlSearchService.getHealthStatus();
  } catch (error) {
    return {
      status: 'unhealthy',
      last_error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check Gemini AI API health
 */
async function checkGeminiHealth(): Promise<ServiceHealth> {
  try {
    return await GeminiService.getHealthStatus();
  } catch (error) {
    return {
      status: 'unhealthy',
      last_error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    const { supabaseServer } = await import("@/lib/supabase-server");
    const supabase = await supabaseServer();
    
    // Test with a simple query
    const { data, error } = await supabase
      .from('search_configurations')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      return {
        status: 'unhealthy',
        response_time_ms: responseTime,
        last_error: error.message
      };
    }
    
    return {
      status: 'healthy',
      response_time_ms: responseTime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      response_time_ms: Date.now() - startTime,
      last_error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get retry service metrics
 */
async function getRetryMetrics(): Promise<Map<string, { totalAttempts: number; totalRetries: number; totalFailures: number }>> {
  try {
    return RetryService.getMetrics();
  } catch (error) {
    console.error("Failed to get retry metrics:", error);
    return new Map();
  }
}