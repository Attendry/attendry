export async function search(params: { q: string; country?: string }) {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('q', params.q);
  url.searchParams.set('key', process.env.GOOGLE_API_KEY!);
  url.searchParams.set('cx', process.env.GOOGLE_CSE_CX!);
  url.searchParams.set('num', '10');
  url.searchParams.set('safe', 'off');

  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));

  const items: string[] = (json?.items ?? [])
    .map((x: any) => x?.link)
    .filter((u: string) => typeof u === 'string' && u.startsWith('http'));

  return { items, debug: { rawCount: items.length } };
}
