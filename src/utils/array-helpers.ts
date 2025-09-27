/**
 * Array Helper Utilities
 * 
 * Provides type-safe array operations and normalization
 */

// Helper to normalize provider lists (no more .filter on a string)
export function normalizeProviders(input?: string | string[]) {
  if (Array.isArray(input)) return input.filter(Boolean).map(s => s.trim());
  if (typeof input === 'string') {
    return input.split(',').map(s => s.trim()).filter(Boolean);
  }
  // default order
  return ['firecrawl', 'cse'];
}

// Type guard for arrays
export function asArray<T>(v: T | T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : (v == null ? [] : [v as T]);
}

// Safe array filtering
export function safeFilter<T>(arr: T[] | null | undefined, predicate: (item: T) => boolean): T[] {
  return asArray(arr).filter(predicate);
}
