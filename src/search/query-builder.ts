/**
 * Centralized Query Builder - Single Authority
 * 
 * Prevents unsolicited augmentation and ensures query length limits.
 * Only source of truth for all search queries.
 */

export type BuiltQuery = { 
  q: string; 
  len: number; 
  tier: 'A'|'B'|'C'; 
  tokens: {text: string, source: 'user_config'|'augmented'}[] 
};

const MAX_Q = 230;
const ENABLE = process.env.ENABLE_QUERY_AUGMENTATION === '1';

// Small, opt-in German event scaffold
const EVENT_DE = ['Konferenz','Kongress','Tagung','Seminar','Workshop','Forum','Symposium','Veranstaltung','Fortbildung'];
const CITIES_DE = ['Berlin','München','Frankfurt','Köln','Düsseldorf','Hamburg','Stuttgart','Leipzig','Nürnberg','Hannover'];

function clamp(q: string) { 
  return q.length <= MAX_Q ? q : q.slice(0, MAX_Q); 
}

export function buildTierQueries(baseQuery: string) {
  if (!baseQuery?.trim()) throw new Error('baseQuery missing');
  const base = `(${baseQuery.trim()})`;
  const baseToken = { text: baseQuery.trim(), source: 'user_config' as const };

  const make = (clauses: string[], tier: 'A'|'B'|'C', augTokens: string[] = []): BuiltQuery => {
    const q = clamp(clauses.join(' '));
    return {
      q, len: q.length, tier,
      tokens: [baseToken, ...augTokens.map(t => ({ text: t, source: 'augmented' as const }))],
    };
  };

  // Tier A: base only (no augmentation by default)
  const tierA: BuiltQuery[] = [make([base], 'A')];

  // Tier B: city shards only if ENABLE flag
  const tierB: BuiltQuery[] = ENABLE
    ? CITIES_DE.map(city => make([base, `("${city}" OR Germany)`], 'B', [city]))
    : [];

  // Tier C: minimal event scaffold only if ENABLE flag
  const tierC: BuiltQuery[] = ENABLE
    ? [make([base, `(${EVENT_DE.join(' OR ')})`], 'C', EVENT_DE)]
    : [];

  return { tierA, tierB, tierC };
}

/**
 * Guard against rogue augmentation
 */
export function assertNoRogueAugmentation(q: string) {
  // Block phrases that have been sneaking in
  const banned = /(general counsel|chief compliance officer|legal operations|Epiq|FTI Consulting|regtech|ESG|industry event|trade show)/i;
  if (banned.test(q)) throw new Error('Rogue augmentation detected in query');
  if (q.length > 230) throw new Error('Query exceeds 230 chars');
}
