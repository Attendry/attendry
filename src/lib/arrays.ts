/**
 * Defensive Array Helpers
 * 
 * Provides robust handling for values that should be arrays but sometimes come in as strings
 */

// Defensive helpers for values that *should* be arrays but sometimes come in as strings
export function ensureArray<T = string>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];

  if (typeof v === 'string') {
    const s = v.trim();

    // Try JSON array first: '["firecrawl","cse"]'
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed as T[];
      } catch { /* fall through */ }
    }

    // Comma-separated list: 'firecrawl,cse'
    if (s.includes(',')) {
      return s.split(',').map(x => x.trim()).filter(Boolean) as T[];
    }

    // Single token string -> one-element array
    return s ? [s as T] : [];
  }

  // null/undefined/other -> empty array
  return [];
}

export function safeFilter<T>(v: unknown, pred: (x: T) => boolean): T[] {
  return ensureArray<T>(v).filter(pred);
}
