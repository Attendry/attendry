/**
 * Google CSE Provider Adapter
 * 
 * Minimal params to avoid 400 errors
 */

export async function cseSearch(q: string): Promise<string[]> {
  const base = 'https://www.googleapis.com/customsearch/v1';
  const key = process.env.GOOGLE_CSE_KEY!;
  const url = `${base}?q=${encodeURIComponent(q)}&key=${key}&num=10`;
  const r = await fetch(url);
  if (r.status !== 200) return [];
  const j = await r.json();
  return (j.items ?? []).map((i: any) => i.link).filter(Boolean);
}
