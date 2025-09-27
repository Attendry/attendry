/**
 * Single Source of Truth for Query Building
 * 
 * Defines baseQuery plumbing and prevents rogue augmentation
 */

export type Tier = 'A'|'B'|'C';
export type BuiltQuery = { tier: Tier; q: string; len: number };

const MAX_Q = 230;
const EVENT_DE = ['Konferenz','Kongress','Tagung','Seminar','Workshop','Symposium','Forum','Veranstaltung','Fortbildung'];

export function buildTierQueries(baseQuery: string, enableAugmentation = false): BuiltQuery[] {
  if (!baseQuery?.trim()) throw new Error('baseQuery missing');
  const base = `(${baseQuery.trim()})`;
  const tiers: BuiltQuery[] = [{ tier: 'A', q: base, len: base.length }];

  if (enableAugmentation) {
    const chip = `(${EVENT_DE.join(' OR ')})`;
    const qC = `${base} ${chip}`.slice(0, MAX_Q);
    tiers.push({ tier: 'C', q: qC, len: qC.length });
  }
  return tiers;
}

export function assertClean(q: string) {
  const banned = /(general counsel|chief compliance officer|legal operations|Epiq|FTI Consulting|industry event|trade show)/i;
  if (banned.test(q)) throw new Error('Rogue augmentation: ' + q);
  if (q.length > MAX_Q) throw new Error('Query too long');
}
