export type BuildQueryOpts = { baseQuery: string; userText?: string };

export function buildSearchQuery({ baseQuery, userText = '' }: BuildQueryOpts): string {
  const bq = baseQuery.trim();
  const ut = userText.trim();
  if (!bq) throw new Error('buildSearchQuery: baseQuery missing'); // will not trigger now
  if (ut) return ut.startsWith('(') && ut.endsWith(')') ? ut : `(${ut})`;
  return bq.startsWith('(') && bq.endsWith(')') ? bq : `(${bq})`;
}
