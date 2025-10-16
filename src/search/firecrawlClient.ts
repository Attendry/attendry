import { firecrawlSearch } from '@/providers/firecrawl';
import { logSynthetic } from './log';
import { metrics } from './metrics';
import type { FirecrawlClientConfig } from './types';

let consecutiveFailures = 0;
let circuitOpenedAt: number | null = null;

const DEFAULT_CONFIG: FirecrawlClientConfig = {
  timeoutMs: Number(process.env.FIRECRAWL_TIMEOUT_MS ?? 20_000),
  maxRetries: Number(process.env.FIRECRAWL_MAX_RETRIES ?? 2),
  openThreshold: Number(process.env.FIRECRAWL_CIRCUIT_OPEN_THRESHOLD ?? 5),
  halfOpenAfterMs: Number(process.env.FIRECRAWL_CIRCUIT_HALF_OPEN_AFTER_MS ?? 60_000),
};

export async function runFirecrawlSearch(
  query: string,
  config: Partial<FirecrawlClientConfig> = {},
  correlationId?: string,
): Promise<string[]> {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const extendedTimeoutMs = Math.max(settings.timeoutMs, 30_000);

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
    const timeoutHandle = setTimeout(() => abortController.abort(), extendedTimeoutMs);

    const attemptStart = Date.now();
    metrics.firecrawlAttemptsTotal.inc();
    logSynthetic('firecrawl_attempt', { attempt, query, correlationId, timeoutMs: extendedTimeoutMs });

    const shardQuery = buildShardQuery(query);
    const variantOrder: Array<'full' | 'shard'> =
      attempt === 1 ? ['shard'] : attempt === 2 ? ['full'] : ['shard'];

    const variantFailures: Array<{ variant: 'full' | 'shard'; error: unknown }> = [];

    let winningVariant: 'full' | 'shard' | null = null;
    let winningResponse: string[] | null = null;

    for (const variant of variantOrder) {
      const variantTimeoutMs = variant === 'shard' ? Math.min(extendedTimeoutMs, 15_000) : extendedTimeoutMs;
      const variantController = new AbortController();
      const variantTimeoutHandle = setTimeout(() => variantController.abort(), variantTimeoutMs);

      try {
        const response = await firecrawlSearch(variant === 'full' ? query : shardQuery, {
          signal: variantController.signal,
          ...(variant === 'shard' ? { depth: 0, limit: 8, textOnly: true } : {}),
        });

        clearTimeout(variantTimeoutHandle);
        if (!winningResponse) {
          winningVariant = variant;
          winningResponse = response;
        }
        break;
      } catch (variantError) {
        clearTimeout(variantTimeoutHandle);
        variantFailures.push({ variant, error: variantError });
      }
    }

    if (winningResponse) {
      clearTimeout(timeoutHandle);
      abortController.abort();
      consecutiveFailures = 0;
      circuitOpenedAt = null;

      metrics.firecrawlSuccessTotal.inc();
      metrics.firecrawlLatency.observe(Date.now() - attemptStart);
      if (attempt > 1) {
        logSynthetic('firecrawl_retry_success', {
          attempt,
          query,
          variant: winningVariant,
          shardQuery,
          correlationId,
        });
      } else {
        logSynthetic('firecrawl_success', { query, variant: winningVariant, shardQuery, correlationId });
      }
      return winningResponse;
    }

    clearTimeout(timeoutHandle);
    abortController.abort();
    const finalError = variantFailures.at(-1)?.error ?? new Error('firecrawl_failed_variants');
    lastError = finalError;
    metrics.firecrawlErrorsTotal.inc();

    const timeoutDetected = (err: unknown) =>
      (err as Error | undefined)?.name === 'AbortError'
      || String((err as Error | undefined)?.message ?? '').toLowerCase().includes('timeout');

    const isTimeout = timeoutDetected(finalError) || variantFailures.some((entry) => timeoutDetected(entry.error));

    if (isTimeout) {
      metrics.firecrawlTimeoutsTotal.inc();
    }

    logSynthetic('firecrawl_attempt_failed', {
      attempt,
      query,
      correlationId,
      shardQuery,
      variantsTried: variantFailures.map((entry) => entry.variant),
      error: (finalError as Error)?.message,
      timeout: isTimeout,
      level: isTimeout ? 'info' : 'warn',
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
            limit: 8,
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

const SHARD_KEYWORDS = [
  'legal compliance conference',
  'regulatory conference',
  'risk management event',
  'data protection conference'
];

function buildShardQuery(original: string): string {
  const trimmed = original.trim();
  if (!trimmed) return SHARD_KEYWORDS[0];

  const keyword = SHARD_KEYWORDS[Math.floor(Math.random() * SHARD_KEYWORDS.length)];
  return `${keyword}`;
}
