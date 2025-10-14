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

type Counter = { inc: (value?: number) => void };
type Histogram = { observe: (value: number) => void };

type MetricFactory = {
  counter: (name: string, help: string, labelNames?: string[]) => Counter;
  histogram: (name: string, help: string, buckets?: number[]) => Histogram;
};

const noopCounter: Counter = { inc: () => {} };
const noopHistogram: Histogram = { observe: () => {} };

const factory: MetricFactory = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const client = require('prom-client');
    return {
      counter: (name, help, labelNames = []) => {
        const metric = new client.Counter({ name, help, labelNames });
        return { inc: (value?: number) => metric.inc(value ?? 1) };
      },
      histogram: (name, help, buckets = [100, 500, 1000, 2000, 5000]) => {
        const metric = new client.Histogram({ name, help, buckets });
        return { observe: (value: number) => metric.observe(value) };
      },
    };
  } catch {
    return {
      counter: () => noopCounter,
      histogram: () => noopHistogram,
    };
  }
})();

export const metrics = {
  firecrawlAttemptsTotal: factory.counter('firecrawl_attempts_total', 'Total firecrawl attempts'),
  firecrawlSuccessTotal: factory.counter('firecrawl_success_total', 'Successful firecrawl responses'),
  firecrawlErrorsTotal: factory.counter('firecrawl_errors_total', 'Firecrawl errors'),
  firecrawlTimeoutsTotal: factory.counter('firecrawl_timeouts_total', 'Firecrawl timeout occurrences'),
  firecrawlFailureTotal: factory.counter('firecrawl_failure_total', 'Firecrawl terminal failures'),
  firecrawlCircuitOpen: factory.counter('firecrawl_circuit_open_total', 'Firecrawl circuit open transitions'),
  firecrawlLatency: factory.histogram('firecrawl_latency_ms', 'Firecrawl latency per attempt'),
  firecrawlCombinedTotal: factory.counter('firecrawl_combined_total', 'Firecrawl results combined with CSE'),
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

