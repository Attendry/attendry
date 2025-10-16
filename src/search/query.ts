import type { CountryContext } from '@/lib/utils/country';

export type BuildQueryOpts = {
  baseQuery: string;
  userText?: string;
  maxLen?: number;
  countryContext?: CountryContext;
  timeframeContext?: {
    dateFrom: string | null;
    dateTo: string | null;
    tokens: string[];
  } | null;
};

const wrap = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')') ? trimmed : `(${trimmed})`;
};

export function buildDeEventQuery(): string {
  const positives = [
    '(compliance OR "e-discovery" OR ediscovery OR "legal tech" OR GDPR OR cybersecurity)',
    '(event OR konferenz OR konferenzen OR kongress OR summit)',
    '(Germany OR Deutschland OR DE OR Berlin OR München OR Frankfurt OR Hamburg OR Köln OR Stuttgart OR Düsseldorf OR Leipzig OR Hannover OR Nürnberg)'
  ];
  const negatives = '-reddit -Mumsnet -forum';
  return `${positives.join(' ')} ${negatives}`;
}

export function buildSearchQuery(opts: BuildQueryOpts): string {
  if (!opts || !opts.baseQuery || !opts.baseQuery.trim()) {
    throw new Error('buildSearchQuery: baseQuery missing');
  }

  const baseQuery = opts.baseQuery.trim();
  const userText = (opts.userText ?? '').trim();
  let query = wrap(userText || baseQuery);

  if (opts.countryContext) {
    const ctx = opts.countryContext;
    const negatives = ctx.negativeSites.join(' ').trim();
    const locationSegments = [
      ctx.countryNames.join(' OR '),
      ctx.cities.join(' OR '),
      ctx.locationTokens.join(' OR ')
    ].filter(Boolean)
      .map((segment) => segment.trim())
      .filter(Boolean);

    const parts: string[] = [wrap(query)];

    if (negatives) {
      parts.push(negatives);
    }

    if (locationSegments.length) {
      parts.push(`(${locationSegments.join(' ')})`);
    }

    parts.push(`(site:${ctx.tld} OR ${ctx.inPhrase})`);

    query = parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (opts.timeframeContext?.tokens?.length) {
    const tokens = opts.timeframeContext.tokens.map((token) => token.trim()).filter(Boolean);
    if (tokens.length) {
      query = `${wrap(query)} (${tokens.join(' OR ')})`;
    }
  }

  if (opts.maxLen && query.length > opts.maxLen) {
    query = query.slice(0, opts.maxLen).trimEnd();
    if (!query.endsWith(')')) {
      query = `${query})`;
    }
    if (!query.startsWith('(')) {
      query = `(${query}`;
    }
    if (query.length > opts.maxLen) {
      query = query.slice(0, opts.maxLen);
    }
  }

  return query;
}

export type QueryToken = {
  text: string;
  source: 'user_config' | 'augmented';
};

export type QueryResult = {
  query: string;
  tokens: QueryToken[];
};

export type BuildQueriesOpts = {
  baseQuery: string;
  tier: 'A' | 'B' | 'C';
  city?: string;
};

export function buildQueries(opts: BuildQueriesOpts): QueryResult[] {
  const { baseQuery, tier, city } = opts;
  const enableAug = process.env.ENABLE_QUERY_AUGMENTATION === '1';
  
  const results: QueryResult[] = [];
  
  // Base query
  const baseTokens: QueryToken[] = [
    { text: baseQuery, source: 'user_config' }
  ];
  
  results.push({
    query: baseQuery,
    tokens: baseTokens
  });
  
  // Augmented queries if enabled
  if (enableAug && city) {
    const germanEvents = ['Konferenz', 'Kongress', 'Tagung', 'Seminar', 'Workshop', 'Forum', 'Symposium', 'Veranstaltung', 'Fortbildung'];
    const eventType = germanEvents[Math.floor(Math.random() * germanEvents.length)];
    
    const augmentedQuery = `${baseQuery} ${eventType} ${city}`;
    const augmentedTokens: QueryToken[] = [
      { text: baseQuery, source: 'user_config' },
      { text: eventType, source: 'augmented' },
      { text: city, source: 'augmented' }
    ];
    
    results.push({
      query: augmentedQuery,
      tokens: augmentedTokens
    });
  }
  
  return results;
}

export function buildTierQueries(baseQuery: string, enableAug: boolean): string[] {
  const queries = [baseQuery];
  
  if (enableAug) {
    // Add some basic augmented queries
    queries.push(`${baseQuery} event`);
    queries.push(`${baseQuery} conference`);
  }
  
  return queries;
}

export function assertClean(query: string): boolean {
  const bannedTerms = ['regtech', 'ESG', 'trade show', 'industry event', 'governance', 'risk management', 'privacy'];
  return !bannedTerms.some(term => query.toLowerCase().includes(term.toLowerCase()));
}

export const EVENT_DE = 'event';
export const CITY_DE = 'city';

export function buildEffectiveQuery(opts: BuildQueryOpts): string {
  return buildSearchQuery(opts);
}