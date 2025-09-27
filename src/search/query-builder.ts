/**
 * Centralized Query Builder - Single Authority
 * 
 * Prevents unsolicited augmentation and ensures query length limits.
 * Only source of truth for all search queries.
 */

export type BuiltQuery = { q: string; len: number; tier: 'A'|'B'|'C'; };

const MAX_Q = 230;
const ENABLE = process.env.ENABLE_QUERY_AUGMENTATION === '1';

const EVENT_DE = ['Konferenz','Kongress','Tagung','Seminar','Workshop','Forum','Symposium','Veranstaltung','Fortbildung'];
const CITIES_DE = ['Berlin','München','Frankfurt','Köln','Düsseldorf','Hamburg','Stuttgart','Leipzig','Nürnberg','Hannover'];

const clamp = (s: string) => s.length <= MAX_Q ? s : s.slice(0, MAX_Q);

export function buildTierQueries(baseQuery: string) {
  if (!baseQuery?.trim()) throw new Error('baseQuery missing');
  const base = `(${baseQuery.trim()})`;

  const mk = (parts: string[], tier: 'A'|'B'|'C'): BuiltQuery => {
    const q = clamp(parts.join(' '));
    return { q, len: q.length, tier };
  };

  const A = [mk([base], 'A')];
  const B = ENABLE ? CITIES_DE.map(c => mk([base, `("${c}" OR Germany)`], 'B')) : [];
  const C = ENABLE ? [mk([base, `(${EVENT_DE.join(' OR ')})`], 'C')] : [];
  return { A, B, C };
}

export function assertQueryIsClean(q: string) {
  if (q.length > MAX_Q) throw new Error('Query too long');
  const banned = /(general counsel|chief compliance officer|legal operations|Epiq|FTI Consulting|industry event|trade show)/i;
  if (banned.test(q)) throw new Error('Rogue augmentation: ' + q);
}
