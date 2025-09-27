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
    if (!s) return [];
    if (s.startsWith('[') && s.endsWith(']')) {
      try { const p = JSON.parse(s); if (Array.isArray(p)) return p as T[]; } catch {}
    }
    return s.includes(',') ? (s.split(',').map(x => x.trim()).filter(Boolean) as T[]) : [s as T];
  }
  return [];
}

export const safeFilter = <T>(v: unknown, pred: (x: T) => boolean) => ensureArray<T>(v).filter(pred);
