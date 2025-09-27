/**
 * Google CSE Provider Adapter
 * 
 * Sends exactly what we built - no transformations
 */

export async function cseSearch(q: string): Promise<string[]> {
  console.info(JSON.stringify({ at: 'sending_to_cse', query: q, len: q.length }, null, 2));
  const base = 'https://www.googleapis.com/customsearch/v1';
  const key = process.env.GOOGLE_CSE_KEY!;
  const cx = process.env.GOOGLE_CSE_CX!;
  // Minimal params only (cr/gl/hl/lr combos caused your 400s)
  for (const num of [10, 5]) {
    const url = `${base}?q=${encodeURIComponent(q)}&key=${key}&cx=${cx}&num=${num}`;
    const r = await fetch(url);
    if (r.status === 200) return ((await r.json()).items ?? []).map((i: any) => i.link).filter(Boolean);
  }
  return [];
}
