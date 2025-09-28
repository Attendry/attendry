export type BaseQuerySource =
  | 'body.baseQuery'
  | 'config.searchConfig.baseQuery'
  | 'env.DEFAULT_BASE_QUERY'
  | 'industry.default'
  | 'safe.default';

const DEFAULT_BASE_QUERY_BY_INDUSTRY: Record<string, string> = {
  'legal-compliance':
    '(compliance OR investigation OR "e-discovery" OR ediscovery OR "legal tech" OR "legal technology" OR "GDPR" OR "cybersecurity" OR "interne untersuchung" OR "compliance management")',
};

const SAFE_DEFAULT = '(conference OR konferenz OR event OR veranstaltung)';

export function resolveBaseQuery(opts: {
  bodyBaseQuery?: string;
  industry?: string | null;
  configBaseQuery?: string | null;
  envDefault?: string | null;
}): { baseQuery: string; source: BaseQuerySource } {
  const pick = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

  const fromBody = pick(opts.bodyBaseQuery);
  if (fromBody) return { baseQuery: fromBody, source: 'body.baseQuery' };

  const fromConfig = pick(opts.configBaseQuery);
  if (fromConfig) return { baseQuery: fromConfig, source: 'config.searchConfig.baseQuery' };

  const fromEnv = pick(opts.envDefault);
  if (fromEnv) return { baseQuery: fromEnv, source: 'env.DEFAULT_BASE_QUERY' };

  const fromIndustry = pick(
    opts.industry ? DEFAULT_BASE_QUERY_BY_INDUSTRY[opts.industry] : null
  );
  if (fromIndustry) return { baseQuery: fromIndustry, source: 'industry.default' };

  return { baseQuery: SAFE_DEFAULT, source: 'safe.default' };
}
