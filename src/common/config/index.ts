export type Provider = 'firecrawl'|'cse'|'database';
type RawCfg = { providers?: string|string[]; /* other fields... */ };

const raw: RawCfg = {
  providers: process.env.SEARCH_PROVIDERS ?? 'firecrawl,cse'
  // ...
};

const normalizeList = (v: string|string[]|undefined): string[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

export const cfg = {
  providers: normalizeList(raw.providers) as Provider[],
  // ...
};
