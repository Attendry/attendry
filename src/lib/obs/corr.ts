// Correlation helper – assigns a per-request correlation id.

declare global {
  // eslint-disable-next-line no-var
  var __corr: string | undefined;
}

export function withCorrelation<T>(fn: () => Promise<T>) {
  globalThis.__corr = Math.random().toString(36).slice(2);
  return fn();
}

export function ensureCorrelation() {
  if (!globalThis.__corr) {
    globalThis.__corr = Math.random().toString(36).slice(2);
  }
  return globalThis.__corr;
}



