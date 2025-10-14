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

export function buildSearchQuery(opts: BuildQueryOpts): string {
  if (!opts || !opts.baseQuery || !opts.baseQuery.trim()) {
    throw new Error('buildSearchQuery: baseQuery missing');
  }
  const bq = opts.baseQuery.trim();
  const ut = (opts.userText ?? '').trim();
  const maxLen = opts.maxLen;
  const ctx = opts.countryContext;
  const timeframe = opts.timeframeContext;
  
  let result: string;
  if (ut) {
    result = ut.startsWith('(') && ut.endsWith(')') ? ut : `(${ut})`;
  } else {
    result = bq.startsWith('(') && bq.endsWith(')') ? bq : `(${bq})`;
  }

  if (ctx) {
    const countries = ctx.countryNames.map((name) => name.trim()).filter(Boolean);
    const cities = ctx.cities.map((city) => city.trim()).filter(Boolean);
    const locationHints = ctx.locationTokens.map((token) => token.trim()).filter(Boolean);
    const negatives = ctx.negativeSites.join(' ');
    const countryTokens = countries.length ? `(${countries.join(' OR ')})` : '';
    const cityTokens = cities.length ? `(${cities.join(' OR ')})` : '';
    const locationHintTokens = locationHints.length ? `(${locationHints.join(' OR ')})` : '';
    const locationBias = [countryTokens, cityTokens, locationHintTokens].filter(Boolean).join(' ');
    const biasParts = [
      `(${result})`,
      negatives,
      locationBias ? `(${locationBias})` : '',
      `(site:${ctx.tld} OR ${ctx.inPhrase})`,
    ].filter((part) => Boolean(part && part.trim()));
    result = biasParts.join(' ').trim();
  }

  if (timeframe?.tokens?.length) {
    const tokens = timeframe.tokens.map((token) => token.trim()).filter(Boolean);
    if (tokens.length) {
      const timeframeSegment = `(${tokens.join(' OR ')})`;
      result = [`(${result})`, timeframeSegment].join(' ').trim();
    }
  }
  
  if (maxLen && result.length > maxLen) {
    // Truncate and ensure balanced parentheses
    result = result.substring(0, maxLen - 2) + ')';
    if (!result.startsWith('(')) {
      result = '(' + result;
    }
  }
  
  return result;
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