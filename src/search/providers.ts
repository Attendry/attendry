function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}
export const providers = toArray(process.env.SEARCH_PROVIDERS ?? config?.providers ?? ['firecrawl','cse']);
