/**
 * Fallback Strategies Service
 * 
 * This service provides fallback strategies when external services
 * are unavailable or failing, ensuring graceful degradation.
 */

import { CircuitBreakerState } from './circuit-breaker';

/**
 * Fallback strategy types
 */
export enum FallbackStrategy {
  CACHE_ONLY = 'CACHE_ONLY',
  DEMO_DATA = 'DEMO_DATA',
  REDUCED_FUNCTIONALITY = 'REDUCED_FUNCTIONALITY',
  ALTERNATIVE_SERVICE = 'ALTERNATIVE_SERVICE',
  ERROR_RESPONSE = 'ERROR_RESPONSE',
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  strategy: FallbackStrategy;
  message?: string;
  data?: any;
  alternativeService?: string;
  reducedFeatures?: string[];
}

/**
 * Service fallback configurations
 */
const SERVICE_FALLBACKS: Record<string, FallbackConfig[]> = {
  google_cse: [
    {
      strategy: FallbackStrategy.DEMO_DATA,
      message: 'Search service temporarily unavailable, showing demo results',
      data: [
        {
          title: "Legal Tech Conference 2025 - Munich",
          link: "https://example.com/legal-tech-2025",
          snippet: "Join us for the premier legal technology conference in Munich, featuring compliance, e-discovery, and regulatory technology sessions."
        },
        {
          title: "Compliance Summit 2025 - Berlin",
          link: "https://example.com/compliance-summit-2025",
          snippet: "Annual compliance summit bringing together industry leaders to discuss regulatory changes, risk management, and best practices."
        },
        {
          title: "Data Protection & Privacy Conference - Frankfurt",
          link: "https://example.com/data-protection-2025",
          snippet: "Comprehensive conference on GDPR, data protection, and privacy regulations with expert speakers and practical workshops."
        }
      ]
    },
    {
      strategy: FallbackStrategy.ERROR_RESPONSE,
      message: 'Search service unavailable. Please try again later.'
    }
  ],
  firecrawl: [
    {
      strategy: FallbackStrategy.ALTERNATIVE_SERVICE,
      alternativeService: 'google_cse',
      message: 'Firecrawl unavailable, falling back to Google Search'
    },
    {
      strategy: FallbackStrategy.REDUCED_FUNCTIONALITY,
      message: 'Content extraction unavailable, showing basic search results',
      reducedFeatures: ['content_extraction', 'speaker_extraction', 'enhanced_metadata']
    }
  ],
  gemini: [
    {
      strategy: FallbackStrategy.REDUCED_FUNCTIONALITY,
      message: 'AI processing unavailable, using basic filtering',
      reducedFeatures: ['ai_filtering', 'content_prioritization', 'speaker_extraction']
    },
    {
      strategy: FallbackStrategy.CACHE_ONLY,
      message: 'AI service unavailable, showing cached results only'
    }
  ],
  supabase: [
    {
      strategy: FallbackStrategy.CACHE_ONLY,
      message: 'Database temporarily unavailable, using cached data'
    },
    {
      strategy: FallbackStrategy.ERROR_RESPONSE,
      message: 'Database service unavailable. Please try again later.'
    }
  ]
};

/**
 * Fallback strategies service
 */
export class FallbackStrategies {
  /**
   * Get fallback configuration for a service
   */
  static getFallbackConfig(service: string, fallbackIndex: number = 0): FallbackConfig | null {
    const fallbacks = SERVICE_FALLBACKS[service];
    if (!fallbacks || fallbacks.length === 0) {
      return null;
    }
    
    const index = Math.min(fallbackIndex, fallbacks.length - 1);
    return fallbacks[index];
  }

  /**
   * Get all available fallback strategies for a service
   */
  static getAvailableFallbacks(service: string): FallbackConfig[] {
    return SERVICE_FALLBACKS[service] || [];
  }

  /**
   * Execute fallback strategy
   */
  static async executeFallback<T>(
    service: string,
    fallbackIndex: number,
    originalRequest: () => Promise<T>
  ): Promise<T> {
    const fallbackConfig = this.getFallbackConfig(service, fallbackIndex);
    
    if (!fallbackConfig) {
      throw new Error(`No fallback strategy available for service: ${service}`);
    }

    console.log(`[FALLBACK] Executing ${fallbackConfig.strategy} for ${service}: ${fallbackConfig.message}`);

    switch (fallbackConfig.strategy) {
      case FallbackStrategy.CACHE_ONLY:
        return this.handleCacheOnly<T>(service);
      
      case FallbackStrategy.DEMO_DATA:
        return this.handleDemoData<T>(fallbackConfig);
      
      case FallbackStrategy.REDUCED_FUNCTIONALITY:
        return this.handleReducedFunctionality<T>(fallbackConfig, originalRequest);
      
      case FallbackStrategy.ALTERNATIVE_SERVICE:
        return this.handleAlternativeService<T>(fallbackConfig, originalRequest);
      
      case FallbackStrategy.ERROR_RESPONSE:
        return this.handleErrorResponse<T>(fallbackConfig);
      
      default:
        throw new Error(`Unknown fallback strategy: ${fallbackConfig.strategy}`);
    }
  }

  /**
   * Handle cache-only fallback
   */
  private static async handleCacheOnly<T>(service: string): Promise<T> {
    // This would typically check cache for the service
    // For now, we'll throw an error indicating cache-only mode
    throw new Error(`Service ${service} is in cache-only mode. No fresh data available.`);
  }

  /**
   * Handle demo data fallback
   */
  private static async handleDemoData<T>(config: FallbackConfig): Promise<T> {
    if (!config.data) {
      throw new Error('Demo data not configured for this service');
    }
    
    // Simulate a small delay to mimic real API response
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return config.data as T;
  }

  /**
   * Handle reduced functionality fallback
   */
  private static async handleReducedFunctionality<T>(
    config: FallbackConfig,
    originalRequest: () => Promise<T>
  ): Promise<T> {
    try {
      // Try the original request with reduced functionality
      const result = await originalRequest();
      
      // Add warning about reduced functionality
      if (typeof result === 'object' && result !== null) {
        (result as any).fallbackWarning = {
          message: config.message,
          reducedFeatures: config.reducedFeatures,
          strategy: config.strategy
        };
      }
      
      return result;
    } catch (error) {
      // If reduced functionality also fails, try next fallback
      throw error;
    }
  }

  /**
   * Handle alternative service fallback
   */
  private static async handleAlternativeService<T>(
    config: FallbackConfig,
    originalRequest: () => Promise<T>
  ): Promise<T> {
    if (!config.alternativeService) {
      throw new Error('Alternative service not configured');
    }
    
    // This would typically call the alternative service
    // For now, we'll try the original request with a different approach
    console.log(`[FALLBACK] Attempting alternative service: ${config.alternativeService}`);
    
    try {
      const result = await originalRequest();
      
      // Add warning about using alternative service
      if (typeof result === 'object' && result !== null) {
        (result as any).fallbackWarning = {
          message: config.message,
          alternativeService: config.alternativeService,
          strategy: config.strategy
        };
      }
      
      return result;
    } catch (error) {
      throw new Error(`Both primary and alternative services failed: ${error}`);
    }
  }

  /**
   * Handle error response fallback
   */
  private static async handleErrorResponse<T>(config: FallbackConfig): Promise<T> {
    throw new Error(config.message || 'Service unavailable');
  }

  /**
   * Check if a service has fallback strategies available
   */
  static hasFallbacks(service: string): boolean {
    const fallbacks = SERVICE_FALLBACKS[service];
    return fallbacks && fallbacks.length > 0;
  }

  /**
   * Get the number of fallback strategies for a service
   */
  static getFallbackCount(service: string): number {
    const fallbacks = SERVICE_FALLBACKS[service];
    return fallbacks ? fallbacks.length : 0;
  }

  /**
   * Add custom fallback strategy for a service
   */
  static addFallback(service: string, config: FallbackConfig): void {
    if (!SERVICE_FALLBACKS[service]) {
      SERVICE_FALLBACKS[service] = [];
    }
    SERVICE_FALLBACKS[service].push(config);
  }

  /**
   * Remove fallback strategy for a service
   */
  static removeFallback(service: string, index: number): void {
    const fallbacks = SERVICE_FALLBACKS[service];
    if (fallbacks && index >= 0 && index < fallbacks.length) {
      fallbacks.splice(index, 1);
    }
  }

  /**
   * Get all service fallback configurations
   */
  static getAllFallbacks(): Record<string, FallbackConfig[]> {
    return { ...SERVICE_FALLBACKS };
  }
}

/**
 * Execute request with fallback strategies
 */
export async function executeWithFallback<T>(
  service: string,
  requestFn: () => Promise<T>,
  maxFallbacks: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= maxFallbacks; i++) {
    try {
      if (i === 0) {
        // Try original request first
        return await requestFn();
      } else {
        // Try fallback strategies
        return await FallbackStrategies.executeFallback(service, i - 1, requestFn);
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`[FALLBACK] Attempt ${i + 1} failed for ${service}:`, error);
      
      // Check if we have more fallbacks to try
      if (i >= maxFallbacks || !FallbackStrategies.hasFallbacks(service)) {
        break;
      }
    }
  }
  
  // All attempts failed
  throw lastError || new Error(`All fallback strategies failed for service: ${service}`);
}

/**
 * Check if service should use fallback based on circuit breaker state
 */
export function shouldUseFallback(
  service: string,
  circuitBreakerState: CircuitBreakerState
): boolean {
  if (circuitBreakerState === CircuitBreakerState.OPEN) {
    return true;
  }
  
  if (circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
    // Use fallback for half-open state to be safe
    return true;
  }
  
  return false;
}
