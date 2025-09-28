export type BuildQueryOpts = { baseQuery: string; userText?: string };

export function buildSearchQuery(opts: BuildQueryOpts): string {
  if (!opts || !opts.baseQuery || !opts.baseQuery.trim()) {
    throw new Error('buildSearchQuery: baseQuery missing');
  }
  const bq = opts.baseQuery.trim();
  const ut = (opts.userText ?? '').trim();
  if (ut) return ut.startsWith('(') && ut.endsWith(')') ? ut : `(${ut})`;
  return bq.startsWith('(') && bq.endsWith(')') ? bq : `(${bq})`;
}
