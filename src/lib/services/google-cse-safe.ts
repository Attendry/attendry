/**
 * Google CSE Safe Wrapper
 * 
 * Handles 400/429 errors with progressive parameter sanitization
 */

export async function googleCseSafe(q: string): Promise<string[]> {
  const key = process.env.GOOGLE_CSE_KEY!;
  const base = 'https://www.googleapis.com/customsearch/v1';

  // Pass 1: minimal
  let url = `${base}?q=${encodeURIComponent(q)}&key=${key}&num=10`;

  let res = await fetch(url);
  if (res.status === 200) return (await res.json()).items?.map((i: any) => i.link) ?? [];

  // If 400/429/403, progressively remove risky params / reduce num
  if (res.status === 400 || res.status === 429 || res.status === 403) {
    // 2nd attempt: still minimal but with num=5
    url = `${base}?q=${encodeURIComponent(q)}&key=${key}&num=5`;
    res = await fetch(url);
    if (res.status === 200) return (await res.json()).items?.map((i: any) => i.link) ?? [];
  }

  // 3rd attempt: add German hint safely via 'lr' only (many 400s come from mixing cr/gl/hl)
  url = `${base}?q=${encodeURIComponent(q + ' site:.de OR Germany')}&key=${key}&num=5&lr=lang_de|lang_en`;
  res = await fetch(url);
  if (res.status === 200) return (await res.json()).items?.map((i: any) => i.link) ?? [];

  // give up: return empty, but log status text for diagnostics
  const text = await res.text().catch(() => '');
  console.warn(JSON.stringify({ at: 'cse_error', status: res.status, body: text.slice(0, 300) }));
  return [];
}
