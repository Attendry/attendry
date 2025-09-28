// common/search/queryBuilder.ts
export type BuildQueryOpts = {
  baseQuery: string;     // required
  userText?: string;     // optional raw user query
  excludeTerms?: string; // optional quoted/bare words; may be empty
};

const wrap = (s: string) => {
  const t = (s ?? '').trim();
  if (!t) return '';
  return t.startsWith('(') && t.endsWith(')') ? t : `(${t})`;
};

export function buildSearchQuery(opts: BuildQueryOpts): string {
  if (!opts || !opts.baseQuery || !opts.baseQuery.trim()) {
    throw new Error('baseQuery_missing');
  }
  const bq = wrap(opts.baseQuery);
  const ut = (opts.userText ?? '').trim();
  if (ut) return wrap(ut);

  const ex = (opts.excludeTerms ?? '').trim();
  if (!ex) return bq;

  // turn exclude string into -(term) blocks, respecting quotes already in baseQuery
  const neg = ex
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => (t.startsWith('-') ? t : `-${t}`))
    .join(' ');

  return `${bq} ${neg}`.trim();
}
