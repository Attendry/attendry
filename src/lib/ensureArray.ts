export function ensureArray<T = string>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    // Try JSON array first
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed as T[];
      } catch {}
    }
    // CSV or single
    return s.includes(',') ? (s.split(',').map(x => x.trim()).filter(Boolean) as T[]) : [s as T];
  }
  return [];
}
