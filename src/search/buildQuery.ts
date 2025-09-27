/**
 * Explicit Query Builder
 * 
 * Removes globals and ensures baseQuery is always passed explicitly
 */

export type BuildQueryOpts = {
  baseQuery: string;    // required
  userText?: string;    // optional raw user query
};

export function buildSearchQuery(opts: BuildQueryOpts): string {
  if (!opts || !opts.baseQuery || !opts.baseQuery.trim()) {
    throw new Error('buildSearchQuery: baseQuery missing');
  }
  const bq = opts.baseQuery.trim();
  const ut = (opts.userText ?? '').trim();

  // Wrap exactly once; never add postfixes.
  if (ut) return ut.startsWith('(') && ut.endsWith(')') ? ut : `(${ut})`;
  return bq.startsWith('(') && bq.endsWith(')') ? bq : `(${bq})`;
}
