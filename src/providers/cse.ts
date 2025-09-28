export async function search(params: { q: string; country?: string }) {
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('q', params.q);
    url.searchParams.set('key', process.env.GOOGLE_API_KEY!);
    url.searchParams.set('cx', process.env.GOOGLE_CSE_CX!);
    url.searchParams.set('num', '10');
    url.searchParams.set('safe', 'off');

    console.log('[cse] Making request to:', url.toString().replace(/key=[^&]+/, 'key=***'));

    const res = await fetch(url.toString());
    console.log('[cse] Response status:', res.status, res.statusText);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[cse] API error:', res.status, errorText);
      return { items: [], debug: { error: `HTTP ${res.status}: ${errorText}`, rawCount: 0 } };
    }

    const json = await res.json().catch(() => ({}));
    console.log('[cse] Response data:', JSON.stringify(json, null, 2));

    const items: string[] = (json?.items ?? [])
      .map((x: any) => x?.link)
      .filter((u: string) => typeof u === 'string' && u.startsWith('http'));

    console.log('[cse] Extracted URLs:', items.length, items.slice(0, 3));

    return { items, debug: { rawCount: items.length, responseKeys: Object.keys(json) } };
  } catch (error) {
    console.error('[cse] Request failed:', error);
    return { items: [], debug: { error: error instanceof Error ? error.message : 'Unknown error', rawCount: 0 } };
  }
}
