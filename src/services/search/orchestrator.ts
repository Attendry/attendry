import { cfg } from '../../common/config';
import { buildSearchQuery } from '../../common/search/buildQuery';
import { providers } from '../../providers';

export type Provider = 'firecrawl'|'cse'|'database';
export type ProviderResult = { provider: Provider; items: string[]; debug?: any };

const mergeUnique = (a: string[], b: string[]) => {
  const s = new Set(a);
  for (const u of b) s.add(u);
  return [...s];
};

export async function executeSearch(opts: {
  baseQuery: string;
  userText?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ items: string[]; providerUsed: Provider; providersTried: Provider[]; logs: any[] }> {
  const logs:any[] = [];
  const q = buildSearchQuery({ baseQuery: opts.baseQuery, userText: opts.userText });

  let best: ProviderResult | null = null;
  const tried: Provider[] = [];

  // Helper to adopt results if non-empty, otherwise keep looking
  const consider = (r: ProviderResult) => {
    tried.push(r.provider);
    logs.push({ at: 'provider_result', provider: r.provider, count: r.items.length });
    if (!best && r.items.length > 0) best = r; // adopt first non-empty
    else if (best && r.items.length > 0 && best.provider !== r.provider) {
      // optional: additive enrichment
      best = { ...best, items: mergeUnique(best.items, r.items) };
    }
  };

  // Provider order from config
  for (const p of cfg.providers) {
    if (p === 'database') {
      const r = await providers.database.search({ q });        // must return {items:string[]}
      consider({ provider: 'database', items: r.items, debug: r.debug });
      continue;
    }
    if (p === 'firecrawl') {
      // IMPORTANT: no hard-coded "veranstaltung germany berlin 2025" and no tbs/location by default
      const r = await providers.firecrawl.search({
        q,
        // If you need date constraints, expose them as typed fields the provider understands.
        // DO NOT send "tbs" or "location" unless feature-flagged:
        // tbs: undefined, location: undefined,
        dateFrom: opts.dateFrom, dateTo: opts.dateTo,
      });
      consider({ provider: 'firecrawl', items: r.items, debug: r.debug });
      continue;
    }
    if (p === 'cse') {
      const r = await providers.cse.search({ q, country: opts.country });
      consider({ provider: 'cse', items: r.items, debug: r.debug });
      continue;
    }
  }

  // If everything empty, return empty once (no phantom overwrite)
  if (!best) return { items: [], providerUsed: cfg.providers[0] ?? 'cse', providersTried: tried, logs };

  return { items: best.items, providerUsed: best.provider, providersTried: tried, logs };
}
