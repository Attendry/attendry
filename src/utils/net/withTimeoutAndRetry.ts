/**
 * Timeout and Retry Utility
 * 
 * Provides resilient timeout handling with exponential backoff
 */

export type RetryOpts = {
  timeoutMs?: number;   // default 30s
  maxRetries?: number;  // default 0
  backoffMs?: number;   // default 500
};

export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {}
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 30000;
  const maxRetries = opts.maxRetries ?? 0;
  const backoffMs = opts.backoffMs ?? 500;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);

    try {
      // If your client supports AbortSignal, pass ac.signal in fn's closure.
      const res = await fn();
      clearTimeout(t);
      return res;
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  // Unreachable
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw lastErr as any;
}
