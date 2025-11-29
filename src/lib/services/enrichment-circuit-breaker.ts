/**
 * Enrichment Circuit Breaker Service
 * 
 * Specialized circuit breaker for speaker enrichment services that:
 * - Prevents cost waste on failing services
 * - Auto-disables enrichment if failure rate > 50%
 * - Integrates with cost tracking
 * - Provides graceful fallback (skip enrichment if service down)
 * 
 * Builds on existing circuit breaker infrastructure but specialized for enrichment.
 */

import { getServiceCircuitBreaker, CIRCUIT_BREAKER_CONFIGS } from '@/lib/services/circuit-breaker';
import { trackAPICost } from './cost-tracker';
import { getRedisClient } from '@/lib/cache/redis-client';

export type EnrichmentService = 'firecrawl' | 'gemini' | 'google_cse';

export interface EnrichmentCircuitBreakerConfig {
  failureThreshold: number;        // Failures before opening circuit
  failureRateThreshold: number;   // Failure rate (0-1) to auto-disable (default 0.5 = 50%)
  successThreshold: number;        // Successes to close from half-open
  timeout: number;                // Request timeout (ms)
  resetTimeout: number;           // Time before attempting half-open (ms)
  monitoringWindow: number;       // Window for failure rate calculation (ms)
  autoDisableOnHighFailureRate: boolean; // Auto-disable if failure rate > threshold
}

export interface EnrichmentOptions {
  userId?: string;
  feature?: string;
  fallback?: () => Promise<any>;
  trackCost?: boolean;
  metadata?: Record<string, any>; // Additional metadata for cost tracking (tokens, etc.)
}

export interface EnrichmentServiceStatus {
  service: EnrichmentService;
  enabled: boolean;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureRate: number;
  totalCalls: number;
  failures: number;
  lastFailureTime: number | null;
  autoDisabled: boolean;
  reason?: string;
}

// Default configuration for enrichment services
const DEFAULT_ENRICHMENT_CONFIG: EnrichmentCircuitBreakerConfig = {
  failureThreshold: 5,
  failureRateThreshold: 0.5, // 50% failure rate triggers auto-disable
  successThreshold: 3,
  timeout: 60000,
  resetTimeout: 30000,
  monitoringWindow: 300000, // 5 minutes
  autoDisableOnHighFailureRate: true,
};

// Service-specific configurations
const SERVICE_CONFIGS: Record<EnrichmentService, Partial<EnrichmentCircuitBreakerConfig>> = {
  firecrawl: {
    failureThreshold: 3,
    failureRateThreshold: 0.5,
    timeout: 60000,
    resetTimeout: 30000,
  },
  gemini: {
    failureThreshold: 5,
    failureRateThreshold: 0.5,
    timeout: 60000,
    resetTimeout: 30000,
  },
  google_cse: {
    failureThreshold: 3,
    failureRateThreshold: 0.5,
    timeout: 60000,
    resetTimeout: 30000,
  },
};

/**
 * Enrichment Circuit Breaker Service
 */
export class EnrichmentCircuitBreaker {
  private static instance: EnrichmentCircuitBreaker;
  private serviceStatuses: Map<EnrichmentService, EnrichmentServiceStatus> = new Map();
  private callHistory: Map<EnrichmentService, Array<{ timestamp: number; success: boolean }>> = new Map();
  private redis = getRedisClient();

  private constructor() {
    this.initializeServices();
    // Load persisted auto-disable status from Redis
    this.loadPersistedStatus().catch(error => {
      console.warn('[enrichment-circuit-breaker] Failed to load persisted status on init:', error);
    });
  }

  static getInstance(): EnrichmentCircuitBreaker {
    if (!EnrichmentCircuitBreaker.instance) {
      EnrichmentCircuitBreaker.instance = new EnrichmentCircuitBreaker();
    }
    return EnrichmentCircuitBreaker.instance;
  }

  private initializeServices(): void {
    const services: EnrichmentService[] = ['firecrawl', 'gemini', 'google_cse'];
    for (const service of services) {
      this.serviceStatuses.set(service, {
        service,
        enabled: true,
        circuitState: 'CLOSED',
        failureRate: 0,
        totalCalls: 0,
        failures: 0,
        lastFailureTime: null,
        autoDisabled: false,
      });
      this.callHistory.set(service, []);
    }
  }

  /**
   * Execute enrichment operation with circuit breaker protection
   */
  async executeEnrichment<T>(
    service: EnrichmentService,
    operation: () => Promise<T>,
    options: EnrichmentOptions = {}
  ): Promise<T> {
    const status = this.serviceStatuses.get(service);
    if (!status) {
      throw new Error(`Unknown enrichment service: ${service}`);
    }

    // Check if service is auto-disabled
    if (status.autoDisabled || !status.enabled) {
      console.warn(`[enrichment-circuit-breaker] Service ${service} is disabled, using fallback`);
      if (options.fallback) {
        return await options.fallback();
      }
      throw new Error(`Enrichment service ${service} is disabled`);
    }

    // Get circuit breaker for service
    const config = { ...DEFAULT_ENRICHMENT_CONFIG, ...SERVICE_CONFIGS[service] };
    const circuitBreaker = getServiceCircuitBreaker(service, {
      failureThreshold: config.failureThreshold,
      successThreshold: config.successThreshold,
      timeout: config.timeout,
      resetTimeout: config.resetTimeout,
    });

    const startTime = Date.now();
    let success = false;
    let error: Error | null = null;

    try {
      // Execute with circuit breaker
      const result = await circuitBreaker.execute(operation);
      success = true;
      
      // Track cost if enabled
      if (options.trackCost !== false) {
        try {
          const responseTime = Date.now() - startTime;
          await trackAPICost(
            options.userId,
            service === 'google_cse' ? 'google_cse' : service,
            options.feature as any,
            {
              calls: 1,
              cacheHit: false,
              // Include token info if provided in metadata
              ...(options.metadata?.inputTokens ? { inputTokens: options.metadata.inputTokens } : {}),
              ...(options.metadata?.outputTokens ? { outputTokens: options.metadata.outputTokens } : {}),
              metadata: {
                service,
                responseTime,
                ...(options.metadata?.metadata || {}), // Include nested metadata
              },
            }
          );
        } catch (costError) {
          console.warn(`[enrichment-circuit-breaker] Failed to track cost for ${service}:`, costError);
        }
      }

      // Record success
      this.recordCall(service, true);
      this.updateServiceStatus(service, circuitBreaker.getState());
      
      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      success = false;

      // Track cost for failed call (still costs money even if it fails)
      if (options.trackCost !== false) {
        try {
          const responseTime = Date.now() - startTime;
          await trackAPICost(
            options.userId,
            service === 'google_cse' ? 'google_cse' : service,
            options.feature as any,
            {
              calls: 1,
              cacheHit: false,
              ...(options.metadata || {}),
              metadata: {
                service,
                responseTime,
                error: error.message,
                failed: true,
                ...(options.metadata?.metadata || {}),
              },
            }
          );
        } catch (costError) {
          console.warn(`[enrichment-circuit-breaker] Failed to track cost for ${service}:`, costError);
        }
      }

      // Record failure
      this.recordCall(service, false);
      this.updateServiceStatus(service, circuitBreaker.getState());

      // Check if we should auto-disable
      if (config.autoDisableOnHighFailureRate) {
        await this.checkAutoDisable(service, config);
      }

      // Try fallback if available
      if (options.fallback) {
        console.log(`[enrichment-circuit-breaker] Using fallback for ${service} due to error`);
        return await options.fallback();
      }

      throw error;
    }
  }

  /**
   * Record a call (success or failure)
   */
  private recordCall(service: EnrichmentService, success: boolean): void {
    const history = this.callHistory.get(service) || [];
    history.push({
      timestamp: Date.now(),
      success,
    });

    // Keep only recent history (within monitoring window)
    const config = { ...DEFAULT_ENRICHMENT_CONFIG, ...SERVICE_CONFIGS[service] };
    const cutoff = Date.now() - config.monitoringWindow;
    const filtered = history.filter(call => call.timestamp > cutoff);
    this.callHistory.set(service, filtered);

    // Update status
    const status = this.serviceStatuses.get(service);
    if (status) {
      status.totalCalls++;
      if (!success) {
        status.failures++;
        status.lastFailureTime = Date.now();
      }
    }
  }

  /**
   * Update service status from circuit breaker state
   */
  private updateServiceStatus(service: EnrichmentService, circuitState: string): void {
    const status = this.serviceStatuses.get(service);
    if (status) {
      status.circuitState = circuitState as 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    }
  }

  /**
   * Check if service should be auto-disabled based on failure rate
   */
  private async checkAutoDisable(
    service: EnrichmentService,
    config: EnrichmentCircuitBreakerConfig
  ): Promise<void> {
    const history = this.callHistory.get(service) || [];
    if (history.length < 10) {
      // Need minimum calls to calculate failure rate
      return;
    }

    const recentCalls = history.filter(
      call => call.timestamp > Date.now() - config.monitoringWindow
    );

    if (recentCalls.length === 0) return;

    const failures = recentCalls.filter(call => !call.success).length;
    const failureRate = failures / recentCalls.length;

    const status = this.serviceStatuses.get(service);
    if (status) {
      status.failureRate = failureRate;

      // Auto-disable if failure rate exceeds threshold
      if (failureRate >= config.failureRateThreshold && !status.autoDisabled) {
        status.autoDisabled = true;
        status.enabled = false;
        status.reason = `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold ${(config.failureRateThreshold * 100).toFixed(1)}%`;

        // Store in Redis for persistence across restarts
        try {
          const redis = await this.redis;
          if (redis) {
            const key = `enrichment:disabled:${service}`;
            await redis.setex(key, 3600, JSON.stringify({ // 1 hour TTL
              disabled: true,
              reason: status.reason,
              disabledAt: Date.now(),
            }));
          }
        } catch (error) {
          console.warn(`[enrichment-circuit-breaker] Failed to persist auto-disable status:`, error);
        }

        console.warn(
          `[enrichment-circuit-breaker] Auto-disabled ${service}: ${status.reason}`
        );
      }
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(service: EnrichmentService): EnrichmentServiceStatus | undefined {
    const status = this.serviceStatuses.get(service);
    if (!status) return undefined;

    // Calculate current failure rate
    const history = this.callHistory.get(service) || [];
    const config = { ...DEFAULT_ENRICHMENT_CONFIG, ...SERVICE_CONFIGS[service] };
    const recentCalls = history.filter(
      call => call.timestamp > Date.now() - config.monitoringWindow
    );

    if (recentCalls.length > 0) {
      const failures = recentCalls.filter(call => !call.success).length;
      status.failureRate = failures / recentCalls.length;
    }

    return { ...status };
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): Record<EnrichmentService, EnrichmentServiceStatus> {
    const statuses: Record<string, EnrichmentServiceStatus> = {};
    for (const service of ['firecrawl', 'gemini', 'google_cse'] as EnrichmentService[]) {
      const status = this.getServiceStatus(service);
      if (status) {
        statuses[service] = status;
      }
    }
    return statuses as Record<EnrichmentService, EnrichmentServiceStatus>;
  }

  /**
   * Manually enable/disable a service
   */
  async setServiceEnabled(service: EnrichmentService, enabled: boolean): Promise<void> {
    const status = this.serviceStatuses.get(service);
    if (status) {
      status.enabled = enabled;
      if (enabled) {
        status.autoDisabled = false;
        status.reason = undefined;
      }

      // Update Redis
      try {
        const redis = await this.redis;
        if (redis) {
          const key = `enrichment:disabled:${service}`;
          if (enabled) {
            await redis.del(key);
          } else {
            await redis.setex(key, 3600, JSON.stringify({
              disabled: true,
              reason: 'Manually disabled',
              disabledAt: Date.now(),
            }));
          }
        }
      } catch (error) {
        console.warn(`[enrichment-circuit-breaker] Failed to persist service status:`, error);
      }
    }
  }

  /**
   * Check if service is available for enrichment
   */
  isServiceAvailable(service: EnrichmentService): boolean {
    const status = this.serviceStatuses.get(service);
    if (!status) return false;
    return status.enabled && !status.autoDisabled && status.circuitState !== 'OPEN';
  }

  /**
   * Reset service (clear auto-disable, reset circuit breaker)
   */
  async resetService(service: EnrichmentService): Promise<void> {
    const status = this.serviceStatuses.get(service);
    if (status) {
      status.autoDisabled = false;
      status.enabled = true;
      status.reason = undefined;
      status.failures = 0;
      status.failureRate = 0;
    }

    // Clear call history
    this.callHistory.set(service, []);

    // Reset circuit breaker
    const circuitBreaker = getServiceCircuitBreaker(service);
    circuitBreaker.reset();

    // Clear Redis
    try {
      const redis = await this.redis;
      if (redis) {
        await redis.del(`enrichment:disabled:${service}`);
      }
    } catch (error) {
      console.warn(`[enrichment-circuit-breaker] Failed to clear Redis:`, error);
    }
  }

  /**
   * Load persisted auto-disable status from Redis
   */
  async loadPersistedStatus(): Promise<void> {
    try {
      const redis = await this.redis;
      if (!redis) return;

      for (const service of ['firecrawl', 'gemini', 'google_cse'] as EnrichmentService[]) {
        const key = `enrichment:disabled:${service}`;
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const status = this.serviceStatuses.get(service);
          if (status && parsed.disabled) {
            status.autoDisabled = true;
            status.enabled = false;
            status.reason = parsed.reason || 'Auto-disabled';
            console.log(`[enrichment-circuit-breaker] Loaded persisted disable status for ${service}`);
          }
        }
      }
    } catch (error) {
      console.warn(`[enrichment-circuit-breaker] Failed to load persisted status:`, error);
    }
  }
}

/**
 * Get enrichment circuit breaker instance
 */
export function getEnrichmentCircuitBreaker(): EnrichmentCircuitBreaker {
  return EnrichmentCircuitBreaker.getInstance();
}

/**
 * Execute enrichment with circuit breaker protection
 */
export async function executeEnrichmentWithCircuitBreaker<T>(
  service: EnrichmentService,
  operation: () => Promise<T>,
  options: EnrichmentOptions = {}
): Promise<T> {
  const breaker = getEnrichmentCircuitBreaker();
  return breaker.executeEnrichment(service, operation, options);
}

/**
 * Check if enrichment service is available
 */
export function isEnrichmentServiceAvailable(service: EnrichmentService): boolean {
  const breaker = getEnrichmentCircuitBreaker();
  return breaker.isServiceAvailable(service);
}

