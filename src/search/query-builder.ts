/**
 * Centralized Query Builder - Single Authority
 * 
 * Prevents unsolicited augmentation and ensures query length limits.
 * Only source of truth for all search queries.
 */

export type BuiltQuery = {
  q: string; len: number; tier: 'A'|'B'|'C';
  tokens: { text: string; source: 'user_config'|'augmented' }[];
};

const MAX_Q = 230;
const ENABLE = process.env.ENABLE_QUERY_AUGMENTATION === '1';
const EVENT_DE = ['Konferenz','Kongress','Tagung','Seminar','Workshop','Forum','Symposium','Veranstaltung','Fortbildung'];
const CITIES_DE = ['Berlin','München','Frankfurt','Köln','Düsseldorf','Hamburg','Stuttgart','Leipzig','Nürnberg','Hannover'];

const clamp = (q: string) => q.length <= MAX_Q ? q : q.slice(0, MAX_Q);

export function buildTierQueries(baseQuery: string) {
  if (!baseQuery?.trim()) throw new Error('baseQuery missing');
  const base = `(${baseQuery.trim()})`;
  const baseTok = { text: baseQuery.trim(), source: 'user_config' as const };

  const mk = (clauses: string[], tier: 'A'|'B'|'C', aug: string[] = []): BuiltQuery => {
    const q = clamp(clauses.join(' '));
    return { q, len: q.length, tier, tokens: [baseTok, ...aug.map(t => ({ text: t, source: 'augmented' as const }))] };
  };

  const tierA = [mk([base], 'A')];
  const tierB = ENABLE ? CITIES_DE.map(c => mk([base, `("${c}" OR Germany)`], 'B', [c])) : [];
  const tierC = ENABLE ? [mk([base, `(${EVENT_DE.join(' OR ')})`], 'C', EVENT_DE)] : [];

  return { tierA, tierB, tierC };
}

/**
 * Guard against rogue augmentation
 */
export function assertQueryIsClean(q: string) {
  if (q.length > 230) throw new Error('Query > 230 chars');
  const banned = /(general counsel|chief compliance officer|legal operations|Epiq|FTI Consulting|industry event|trade show)/i;
  if (banned.test(q)) throw new Error('Rogue augmentation detected: ' + q);
}
