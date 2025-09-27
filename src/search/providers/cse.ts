/**
 * Google CSE Provider Adapter
 * 
 * Sends exactly what we built - no transformations
 */

export async function cseSearch(q: string, opt: { minimal?: boolean } = {}): Promise<string[]> {
  console.info(JSON.stringify({ at: 'sending_to_cse', query: q, len: q.length, minimal: !!opt.minimal }, null, 2));
  const base = 'https://www.googleapis.com/customsearch/v1';
  const key = process.env.GOOGLE_CSE_KEY!;
  const cx = process.env.GOOGLE_CSE_CX!;
  const num = opt.minimal ? 10 : 10; // small to avoid 400s with strict CX

  let url = `${base}?q=${encodeURIComponent(q)}&key=${key}&cx=${cx}&num=${num}`;
  let r = await fetch(url);
  if (r.status === 200) return ((await r.json()).items || []).map((i: any) => i.link);

  // retry with even more minimal (no extra params at all)
  url = `${base}?q=${encodeURIComponent(q)}&key=${key}&cx=${cx}&num=5`;
  r = await fetch(url);
  if (r.status === 200) return ((await r.json()).items || []).map((i: any) => i.link);

  console.warn(JSON.stringify({ at: 'cse_error', status: r.status, text: (await r.text()).slice(0, 200) }));
  return [];
}
