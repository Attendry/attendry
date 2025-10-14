import { firecrawlSearch } from '@/providers/firecrawl';
import { logSynthetic } from './log';
import { metrics } from './metrics';
import type { FirecrawlClientConfig } from './types';

let consecutiveFailures = 0;
let circuitOpenedAt: number | null = null;

const DEFAULT_CONFIG: FirecrawlClientConfig = {
  timeoutMs: Number(process.env.FIRECRAWL_TIMEOUT_MS ?? 25_000),
  maxRetries: Number(process.env.FIRECRAWL_MAX_RETRIES ?? 3),
  openThreshold: Number(process.env.FIRECRAWL_CIRCUIT_OPEN_THRESHOLD ?? 5),
  halfOpenAfterMs: Number(process.env.FIRECRAWL_CIRCUIT_HALF_OPEN_AFTER_MS ?? 60_000),
};

export async function runFirecrawlSearch(
  query: string,
  config: Partial<FirecrawlClientConfig> = {},
  correlationId?: string,
): Promise<string[]> {
  const settings = { ...DEFAULT_CONFIG, ...config };

  if (circuitOpenedAt) {
    const elapsed = Date.now() - circuitOpenedAt;
    if (elapsed < settings.halfOpenAfterMs) {
      metrics.firecrawlCircuitOpen.inc();
      throw new Error('firecrawl_circuit_open');
    }
  }

  let attempt = 0;
  let lastError: unknown;

  while (attempt < settings.maxRetries) {
    attempt += 1;
    const jitterMultiplier = 0.7 + Math.random() * 0.6;
    const backoff = attempt === 1 ? 0 : Math.floor(800 * Math.pow(1.7, attempt - 1) * jitterMultiplier);

    if (backoff > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), settings.timeoutMs);

    const attemptStart = Date.now();
    metrics.firecrawlAttemptsTotal.inc();
    logSynthetic('firecrawl_attempt', { attempt, query, correlationId, timeoutMs: settings.timeoutMs });

    try {
      const response = await firecrawlSearch(query, { signal: abortController.signal });
      clearTimeout(timeoutHandle);
      consecutiveFailures = 0;
      circuitOpenedAt = null;

      metrics.firecrawlSuccessTotal.inc();
      metrics.firecrawlLatency.observe(Date.now() - attemptStart);
      return response;
    } catch (error) {
      clearTimeout(timeoutHandle);
      lastError = error;
      metrics.firecrawlErrorsTotal.inc();

      const isTimeout = (error as Error)?.name === 'AbortError' || String((error as Error)?.message).includes('timeout');
      if (isTimeout) {
        metrics.firecrawlTimeoutsTotal.inc();
      }

      logSynthetic('firecrawl_attempt_failed', {
        attempt,
        query,
        correlationId,
        error: (error as Error)?.message,
        timeout: isTimeout,
      });

      if (attempt >= settings.maxRetries) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= settings.openThreshold) {
          circuitOpenedAt = Date.now();
        }

        try {
          const fallback = await firecrawlSearch(query, {
            signal: new AbortController().signal,
            depth: 0,
            textOnly: true,
          });

          logSynthetic('firecrawl_fallback_success', { query, correlationId });
          consecutiveFailures = 0;
          circuitOpenedAt = null;
          return fallback;
        } catch (fallbackError) {
          logSynthetic('firecrawl_fallback_failed', {
            query,
            correlationId,
            error: (fallbackError as Error)?.message,
          });
        }
      }
    }
  }

  metrics.firecrawlFailureTotal.inc();
  throw lastError instanceof Error ? lastError : new Error('firecrawl_failed');
}

export function resetFirecrawlCircuit(): void {
  consecutiveFailures = 0;
  circuitOpenedAt = null;
}
