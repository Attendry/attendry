export type BuildQueryOpts = { baseQuery: string; userText?: string | null };

const wrap = (s: string) => (s.startsWith('(') && s.endsWith(')') ? s : `(${s})`);

export function buildEffectiveQuery({ baseQuery, userText }: BuildQueryOpts): string {
  const bq = (baseQuery ?? '').trim();
  const ut = (userText ?? '').trim();
  if (!bq) throw new Error('buildEffectiveQuery: baseQuery missing');
  return ut ? wrap(ut) : wrap(bq);
}

// Legacy alias to kill old imports safely
export const buildSearchQuery = buildEffectiveQuery;