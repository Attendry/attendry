/**
 * Observability & SLOs
 * 
 * Implements structured logging, metrics, and OpenTelemetry tracing
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { createHash } from 'crypto';

export interface SearchMetrics {
  requests_total: number;
  errors_total: number;
  external_errors_total: Record<string, number>;
  latency_ms_bucket: Record<string, number>;
  precision_at_k: Record<string, number>;
  localisation_accuracy: number;
  cost_per_query_pence: number;
}

export interface StructuredLog {
  correlationId: string;
  stage: string;
  country: string;
  queryHash: string;
  provider: string;
  latencyMs: number;
  status: 'success' | 'error' | 'timeout' | 'budget_exceeded';
  cost?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface SLOTargets {
  availability: number; // 99.9%
  latency_p95: number; // 2000ms
  precision_at_5: number; // 0.85
  localisation_accuracy: number; // 0.99
  cost_per_query_max: number; // 50 pence
}

/**
 * Default SLO targets
 */
const DEFAULT_SLO_TARGETS: SLOTargets = {
  availability: 0.999, // 99.9%
  latency_p95: 2000, // 2 seconds
  precision_at_5: 0.85, // 85%
  localisation_accuracy: 0.99, // 99%
  cost_per_query_max: 50 // 50 pence
};

/**
 * Search Observability Manager
 */
export class SearchObservabilityManager {
  private metrics: SearchMetrics;
  private logs: StructuredLog[] = [];
  private tracer = trace.getTracer('search-pipeline');
  private sloTargets: SLOTargets;

  constructor(sloTargets: SLOTargets = DEFAULT_SLO_TARGETS) {
    this.sloTargets = sloTargets;
    this.metrics = {
      requests_total: 0,
      errors_total: 0,
      external_errors_total: {},
      latency_ms_bucket: {
        '0-100': 0,
        '100-500': 0,
        '500-1000': 0,
        '1000-2000': 0,
        '2000-5000': 0,
        '5000+': 0
      },
      precision_at_k: {
        'p@1': 0,
        'p@3': 0,
        'p@5': 0,
        'p@10': 0
      },
      localisation_accuracy: 0,
      cost_per_query_pence: 0
    };
  }

  /**
   * Create search trace with correlation ID
   */
  createSearchTrace(
    query: string,
    country: string,
    correlationId?: string
  ): {
    correlationId: string;
    span: any;
    log: (stage: string, data: any) => void;
    end: (status: 'success' | 'error', metrics?: any) => void;
  } {
    const id = correlationId || this.generateCorrelationId();
    const queryHash = this.hashQuery(query);
    
    const span = this.tracer.startSpan('search-pipeline', {
      kind: SpanKind.SERVER,
      attributes: {
        'search.query': query,
        'search.country': country,
        'search.correlation_id': id,
        'search.query_hash': queryHash
      }
    });

    const log = (stage: string, data: any) => {
      this.logStructured({
        correlationId: id,
        stage,
        country,
        queryHash,
        provider: data.provider || 'unknown',
        latencyMs: data.latencyMs || 0,
        status: data.status || 'success',
        cost: data.cost,
        metadata: data,
        timestamp: new Date().toISOString()
      });
    };

    const end = (status: 'success' | 'error', metrics?: any) => {
      if (status === 'error') {
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      if (metrics) {
        span.setAttributes({
          'search.latency_ms': metrics.latencyMs,
          'search.cost_pence': metrics.cost || 0,
          'search.results_count': metrics.resultsCount || 0,
          'search.precision_at_5': metrics.precisionAt5 || 0
        });
      }

      span.end();
    };

    return { correlationId: id, span, log, end };
  }

  /**
   * Log structured search event
   */
  logStructured(log: StructuredLog): void {
    this.logs.push(log);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    // Log to console in production
    console.log(JSON.stringify({
      at: 'search_log',
      ...log
    }));
  }

  /**
   * Record search metrics
   */
  recordMetrics(metrics: Partial<SearchMetrics>): void {
    Object.assign(this.metrics, metrics);
  }

  /**
   * Record request completion
   */
  recordRequest(
    latencyMs: number,
    status: 'success' | 'error',
    provider?: string,
    cost?: number
  ): void {
    this.metrics.requests_total++;
    
    if (status === 'error') {
      this.metrics.errors_total++;
      if (provider) {
        this.metrics.external_errors_total[provider] = 
          (this.metrics.external_errors_total[provider] || 0) + 1;
      }
    }

    // Record latency bucket
    const bucket = this.getLatencyBucket(latencyMs);
    this.metrics.latency_ms_bucket[bucket]++;

    // Record cost
    if (cost) {
      this.metrics.cost_per_query_pence = cost;
    }
  }

  /**
   * Record precision metrics
   */
  recordPrecision(k: number, precision: number): void {
    const key = `p@${k}` as keyof typeof this.metrics.precision_at_k;
    if (key in this.metrics.precision_at_k) {
      this.metrics.precision_at_k[key] = precision;
    }
  }

  /**
   * Record localisation accuracy
   */
  recordLocalisationAccuracy(accuracy: number): void {
    this.metrics.localisation_accuracy = accuracy;
  }

  /**
   * Get current metrics
   */
  getMetrics(): SearchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get SLO compliance status
   */
  getSLOStatus(): {
    targets: SLOTargets;
    current: {
      availability: number;
      latency_p95: number;
      precision_at_5: number;
      localisation_accuracy: number;
      cost_per_query_avg: number;
    };
    compliance: {
      availability: boolean;
      latency: boolean;
      precision: boolean;
      localisation: boolean;
      cost: boolean;
    };
  } {
    const totalRequests = this.metrics.requests_total;
    const errorRate = totalRequests > 0 ? this.metrics.errors_total / totalRequests : 0;
    const availability = 1 - errorRate;

    const latencyP95 = this.calculateLatencyP95();
    const precisionAt5 = this.metrics.precision_at_k['p@5'];
    const localisationAccuracy = this.metrics.localisation_accuracy;
    const avgCost = this.metrics.cost_per_query_pence;

    return {
      targets: this.sloTargets,
      current: {
        availability,
        latency_p95: latencyP95,
        precision_at_5: precisionAt5,
        localisation_accuracy: localisationAccuracy,
        cost_per_query_avg: avgCost
      },
      compliance: {
        availability: availability >= this.sloTargets.availability,
        latency: latencyP95 <= this.sloTargets.latency_p95,
        precision: precisionAt5 >= this.sloTargets.precision_at_5,
        localisation: localisationAccuracy >= this.sloTargets.localisation_accuracy,
        cost: avgCost <= this.sloTargets.cost_per_query_max
      }
    };
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): StructuredLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(correlationId: string): StructuredLog[] {
    return this.logs.filter(log => log.correlationId === correlationId);
  }

  /**
   * Generate correlation ID
   */
  private generateCorrelationId(): string {
    return createHash('md5')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Hash query for consistent identification
   */
  private hashQuery(query: string): string {
    return createHash('md5')
      .update(query.toLowerCase().trim())
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Get latency bucket for metric
   */
  private getLatencyBucket(latencyMs: number): string {
    if (latencyMs < 100) return '0-100';
    if (latencyMs < 500) return '100-500';
    if (latencyMs < 1000) return '500-1000';
    if (latencyMs < 2000) return '1000-2000';
    if (latencyMs < 5000) return '2000-5000';
    return '5000+';
  }

  /**
   * Calculate P95 latency from buckets
   */
  private calculateLatencyP95(): number {
    const buckets = this.metrics.latency_ms_bucket;
    const total = Object.values(buckets).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) return 0;

    const p95Index = Math.floor(total * 0.95);
    let currentIndex = 0;

    for (const [bucket, count] of Object.entries(buckets)) {
      currentIndex += count;
      if (currentIndex >= p95Index) {
        // Return midpoint of bucket
        const [min, max] = bucket.split('-').map(Number);
        return max ? (min + max) / 2 : min;
      }
    }

    return 5000; // Default to highest bucket
  }
}

/**
 * OpenTelemetry Instrumentation
 */
export class SearchInstrumentation {
  private tracer = trace.getTracer('search-pipeline');

  /**
   * Instrument external API call
   */
  async instrumentExternalCall<T>(
    provider: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(`${provider}.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'external.provider': provider,
        'external.operation': operation
      }
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Instrument cache operation
   */
  async instrumentCacheOperation<T>(
    operation: 'get' | 'set' | 'delete',
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(`cache.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'cache.operation': operation,
        'cache.key': key
      }
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Instrument LLM operation
   */
  async instrumentLLMOperation<T>(
    model: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const span = this.tracer.startSpan(`llm.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'llm.model': model,
        'llm.operation': operation
      }
    });

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      span.end();
    }
  }
}

/**
 * Global observability instance
 */
export const searchObservability = new SearchObservabilityManager();
export const searchInstrumentation = new SearchInstrumentation();

/**
 * Middleware for request correlation
 */
export function withCorrelation<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const correlationId = searchObservability['generateCorrelationId']();
    
    // Set correlation ID in context
    return context.with(
      context.setValue(context.active(), 'correlationId', correlationId),
      () => fn(...args)
    );
  };
}

/**
 * Get correlation ID from context
 */
export function getCorrelationId(): string | undefined {
  return context.getValue(context.active(), 'correlationId') as string | undefined;
}
