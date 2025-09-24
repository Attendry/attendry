import { RetryService } from "./services/retry-service";

export type FetchOptions = RequestInit & { 
  timeoutMs?: number; 
  retries?: number; 
  retryDelayMs?: number;
  service?: string;
  operation?: string;
};

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 10000,
    retries = 2,
    retryDelayMs = 300,
    service = "generic",
    operation = "fetch",
    ...init
  } = opts;

  // Use the new retry service for better monitoring and configuration
  return RetryService.fetchWithRetry(
    service,
    operation,
    url,
    {
      ...init,
      signal: (() => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), timeoutMs);
        return controller.signal;
      })()
    },
    {
      maxRetries: retries,
      baseDelayMs: retryDelayMs,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      jitterMs: 150
    }
  );
}

export async function fetchJson<T = any>(url: string, opts: FetchOptions = {}): Promise<{ response: Response; data: T | null }> {
  const response = await fetchWithRetry(url, { ...opts, headers: { "Accept": "application/json", ...(opts.headers || {}) } });
  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }
  return { response, data };
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<{ response: Response; text: string }> {
  const response = await fetchWithRetry(url, opts);
  const text = await response.text();
  return { response, text };
}


