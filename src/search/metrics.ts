export type CounterMetric = {
  inc: (labels?: Record<string, string>, value?: number) => void;
};

export type HistogramMetric = {
  observe: (labels: Record<string, string>, value: number) => void;
};

export type GaugeMetric = {
  set: (labels: Record<string, string>, value: number) => void;
};

export interface MetricsRegistry {
  counter(name: string, help: string, labelNames: string[]): CounterMetric;
  histogram(name: string, help: string, labelNames: string[], buckets?: number[]): HistogramMetric;
  gauge(name: string, help: string, labelNames: string[]): GaugeMetric;
}

class NoopCounter implements CounterMetric {
  inc(): void {}
}

class NoopHistogram implements HistogramMetric {
  observe(): void {}
}

class NoopGauge implements GaugeMetric {
  set(): void {}
}

class NoopRegistry implements MetricsRegistry {
  counter(): CounterMetric {
    return new NoopCounter();
  }

  histogram(): HistogramMetric {
    return new NoopHistogram();
  }

  gauge(): GaugeMetric {
    return new NoopGauge();
  }
}

export const defaultRegistry: MetricsRegistry = new NoopRegistry();

export const metrics = {
  searchesTotal: defaultRegistry.counter('searches_total', 'Total search requests', ['intent', 'country']),
  errorsTotal: defaultRegistry.counter('search_errors_total', 'Search errors by stage', ['stage']),
  providerTimeoutsTotal: defaultRegistry.counter('provider_timeouts_total', 'Provider timeouts by stage', ['stage']),
  latencyMs: defaultRegistry.histogram(
    'search_latency_ms',
    'Latency of search stages in milliseconds',
    ['stage'],
    [25, 50, 100, 200, 400, 800, 1600, 3200, 5000]
  ),
  finalScoreDistribution: defaultRegistry.histogram(
    'search_final_score_distribution',
    'Distribution of final hybrid scores',
    [],
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
  ),
  cacheHitRatio: defaultRegistry.gauge('search_cache_hit_ratio', 'Cache hit ratio for search caches', ['cache']),
};

export type LogEvent = {
  correlationId: string;
  stage: string;
  country?: string;
  topK?: number;
  latencyMs?: number;
  error?: string;
  costTokens?: number;
};

export function logEvent(event: LogEvent) {
  console.log(JSON.stringify(event));
}

