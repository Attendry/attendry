function buildCSEUrl(q: string, withLocale: boolean) {
  const u = new URL('https://www.googleapis.com/customsearch/v1');
  u.searchParams.set('q', q.slice(0, 256));   // long queries trigger 400
  u.searchParams.set('key', process.env.GOOGLE_API_KEY!);
  u.searchParams.set('cx', process.env.GOOGLE_CSE_CX!);
  u.searchParams.set('num', '10');
  u.searchParams.set('safe', 'off');

  if (withLocale) {
    u.searchParams.set('hl', 'de');
    // DO NOT set lr/cr/gl together; they frequently cause 400 in combo
    // u.searchParams.set('gl', 'de'); // optional; keep commented unless needed
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
