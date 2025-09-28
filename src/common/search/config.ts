// common/search/config.ts
export type ActiveConfig = {
  id: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms?: string;
  // snake_case mirrors allowed too
  base_query?: string;
  exclude_terms?: string;
};

let cached: ActiveConfig | null = null;

export async function loadActiveConfig(): Promise<ActiveConfig> {
  if (cached) return cached;
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/search-config`, { cache: 'no-store' });
  const json = await res.json();
  const cfg = (json?.config ?? {}) as ActiveConfig;
  // normalize camelCase first, then fall back to snake_case
  const baseQuery = cfg.baseQuery || (cfg.base_query as string) || '';
  const excludeTerms = cfg.excludeTerms || (cfg.exclude_terms as string) || '';
  cached = { ...cfg, baseQuery, excludeTerms };
  return cached!;
}
