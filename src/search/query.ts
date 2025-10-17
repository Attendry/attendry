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

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const DISALLOWED_CHARS = /[^\p{L}\p{N}\s"':().-]/gu;

const sanitize = (input: string): string =>
  input
    .replace(CONTROL_CHARS, '')
    .replace(DISALLOWED_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();

const containsCaseInsensitive = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

const balanceParentheses = (input: string): string => {
  let balance = 0;
  let result = '';
  for (const ch of input) {
    if (ch === '(') {
      balance += 1;
      result += ch;
    } else if (ch === ')') {
      if (balance > 0) {
        balance -= 1;
        result += ch;
      }
    } else {
      result += ch;
    }
  }

  if (balance > 0) {
    result += ')'.repeat(balance);
  }

  return result.trim();
};

const collapseOuterParens = (input: string): string => {
  let value = input.trim();
  while (value.startsWith('(') && value.endsWith(')')) {
    const inner = value.slice(1, -1).trim();
    if (!inner || inner === value || !isBalanced(inner)) {
      break;
    }
    value = inner;
  }
  return value;
};

const isBalanced = (input: string): boolean => {
  let depth = 0;
  for (const ch of input) {
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
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

  const baseQuery = sanitize(opts.baseQuery.trim());
  const userText = sanitize((opts.userText ?? '').trim());
  let query = balanceParentheses(userText || baseQuery);
  query = wrap(query);

  if (opts.countryContext) {
    const ctx = opts.countryContext;
    const negatives = ctx.negativeSites.map((token) => token.trim()).filter(Boolean);
    const missingNegatives = negatives.filter((token) => !containsCaseInsensitive(query, token));

    const locationSegmentsRaw = [
      ctx.countryNames.join(' OR '),
      ctx.cities.join(' OR '),
      ctx.locationTokens.join(' OR ')
    ];

    const locationSegments = locationSegmentsRaw
      .map((segment) => sanitize(segment))
      .filter(Boolean)
      .filter((segment) => !containsCaseInsensitive(query, segment));

    const siteClause = `(site:${ctx.tld} OR ${ctx.inPhrase})`;
    const needsSiteClause = !containsCaseInsensitive(query, `site:${ctx.tld}`) && !containsCaseInsensitive(query, ctx.inPhrase);

    const parts: string[] = [query];
    if (missingNegatives.length) {
      parts.push(missingNegatives.join(' '));
    }
    if (locationSegments.length) {
      parts.push(`(${locationSegments.join(' ')})`);
    }
    if (needsSiteClause) {
      parts.push(siteClause);
    }

    query = parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  if (opts.timeframeContext?.tokens?.length) {
    const tokens = opts.timeframeContext.tokens.map((token) => sanitize(token)).filter(Boolean);
    if (tokens.length) {
      const timeframeSegment = `(${tokens.join(' OR ')})`;
      if (!containsCaseInsensitive(query, timeframeSegment)) {
        query = `${query} ${timeframeSegment}`.trim();
      }
    }
  }

  query = balanceParentheses(query);
  query = collapseOuterParens(query);
  query = wrap(query);

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