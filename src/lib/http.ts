export type FetchOptions = RequestInit & { timeoutMs?: number; retries?: number; retryDelayMs?: number };

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<Response> {
  const {
    timeoutMs = 10000,
    retries = 2,
    retryDelayMs = 300,
    ...init
  } = opts;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(t);
      // Retry on 429/5xx
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
    }

    // backoff with jitter
    const jitter = Math.floor(Math.random() * 150);
    await sleep(retryDelayMs + attempt * 200 + jitter);
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
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


