// common/search/normalize.ts
type FirecrawlItem = { url?: string } & Record<string, unknown>;
type CSEItem = { link?: string } & Record<string, unknown>;

export function extractUrlsFromFirecrawl(items: unknown): string[] {
  const arr = Array.isArray(items) ? items as FirecrawlItem[] : [];
  return arr.map(x => String(x.url || ''))
            .filter(u => /^https?:\/\//i.test(u));
}

export function extractUrlsFromCSE(items: unknown): string[] {
  const arr = Array.isArray(items) ? items as CSEItem[] : [];
  return arr.map(x => String(x.link || ''))
            .filter(u => /^https?:\/\//i.test(u));
}

export function dedupe(urls: string[]): string[] {
  return Array.from(new Set(urls));
}
