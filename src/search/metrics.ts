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

type Labels = Record<string, string>;

const isLabels = (value: unknown): value is Labels => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

type Counter = {
  inc: (labels?: Labels | number, value?: number) => void;
};

type Histogram = {
  observe: (labelsOrValue: Labels | number, value?: number) => void;
};

type MetricFactory = {
  counter: (name: string, help: string, labelNames?: string[]) => Counter;
  histogram: (name: string, help: string, buckets?: number[]) => Histogram;
};

const noopCounter: Counter = { inc: () => {} };
const noopHistogram: Histogram = { observe: () => {} };

let client: any;

const factory: MetricFactory = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    client = require('prom-client');
    return {
      counter: (name, help, labelNames: string[] = []) => {
        const metric = new client.Counter({ name, help, labelNames });
        return {
          inc: (labelsOrValue?: Labels | number, value?: number) => {
            if (isLabels(labelsOrValue)) {
              metric.inc(labelsOrValue, value ?? 1);
            } else if (typeof labelsOrValue === 'number') {
              metric.inc(labelsOrValue);
            } else {
              metric.inc();
            }
          }
        };
      },
      histogram: (name, help, labelNames: string[] = [], buckets = [100, 500, 1000, 2000, 5000]) => {
        const metric = new client.Histogram({ name, help, labelNames, buckets });
        return {
          observe: (labelsOrValue: Labels | number, value?: number) => {
            if (isLabels(labelsOrValue)) {
              if (typeof value !== 'number') return;
              metric.observe(labelsOrValue, value);
            } else if (typeof labelsOrValue === 'number') {
              metric.observe(labelsOrValue);
            }
          }
        };
      },
    };
  } catch {
    return {
      counter: () => ({ inc: () => {} }),
      histogram: () => ({ observe: () => {} }),
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
  discoveryLatency: factory.histogram('search_discovery_latency_ms', 'Total discovery latency'),
  discoveryProvidersAttempt: factory.counter('search_discovery_provider_attempt_total', 'Discovery provider attempts', ['provider']),
  discoveryProvidersSuccess: factory.counter('search_discovery_provider_success_total', 'Successful discovery provider calls', ['provider']),
  discoveryProvidersFailure: factory.counter('search_discovery_provider_failure_total', 'Failed discovery provider calls', ['provider']),
  discoveryProvidersLatency: factory.histogram('search_discovery_provider_latency_ms', 'Discovery provider latency', ['provider']),
  pipelineStageLatency: factory.histogram('search_pipeline_stage_latency_ms', 'Event pipeline stage latency', ['stage']),
  pipelineStageOutputs: factory.counter('search_pipeline_stage_output_total', 'Event pipeline stage output counts', ['stage']),
  pipelineStageFailures: factory.counter('search_pipeline_stage_failure_total', 'Event pipeline stage failure counts', ['stage']),
};

export function getMetricsClient() {
  return client;
}

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

