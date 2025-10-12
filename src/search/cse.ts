function buildCSEUrl(q: string, locale: boolean) {
  const u = new URL('https://www.googleapis.com/customsearch/v1');
  const trimmed = q.length > 256 ? q.slice(0, 256) : q;
  u.searchParams.set('q', trimmed);
  u.searchParams.set('key', process.env.GOOGLE_API_KEY || process.env.CSE_API_KEY!);
  u.searchParams.set('cx', process.env.GOOGLE_CSE_CX!);
  u.searchParams.set('num', '10'); // 50 often trips quota/400
  u.searchParams.set('safe', 'off');
  if (locale) {
    u.searchParams.set('hl', 'de');
    // DO NOT set lr/cr/gl together; observed to cause 400.
    // u.searchParams.set('gl', 'de'); // only enable if you must, and not with 'cr'/'lr'
  }
  return u.toString();
}

export async function cseSearch(q: string) {
  let res = await fetch(buildCSEUrl(q, true));
  if (res.status === 400) res = await fetch(buildCSEUrl(q, false));
  if (!res.ok) return { items: [] };
  const json = await res.json().catch(() => ({}));
  return { items: Array.isArray(json.items) ? json.items : [] };
}
