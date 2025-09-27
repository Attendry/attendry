/**
 * Explicit Query Builder
 * - Requires baseQuery to be passed.
 * - Never reads from globals.
 * - Wraps once with () and prefers userText when present.
 */
export type BuildQueryOpts = {
  baseQuery: string;      // REQUIRED
  userText?: string | null;
};

export function buildQueryExplicit({ baseQuery, userText }: BuildQueryOpts): string {
  const bq = (baseQuery ?? '').trim();
  const ut = (userText ?? '').trim();
  if (!bq) throw new Error('buildQueryExplicit: baseQuery missing');

  const wrap = (s: string) => (s.startsWith('(') && s.endsWith(')') ? s : `(${s})`);
  return ut ? wrap(ut) : wrap(bq);
}

// Backwards-compatible alias to kill old imports safely
export const buildSearchQuery = buildQueryExplicit;