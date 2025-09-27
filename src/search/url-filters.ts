/**
 * URL Filters
 * 
 * Pre-filter URLs to kill obvious noise before extraction
 */

const DOMAIN_BLOCK = [/digamextra\.com/i, /fintech\.global/i, /famnit\.upr\.si/i];
const PATH_BLOCK = [/\/tag\//i, /\/news\//i, /\/blog\//i, /\/category\//i];
const EVENT_HINT = /(veranstalt|konferenz|kongress|tagung|seminar|workshop|symposium|summit|termine|events?)/i;

const ALLOWLIST = /(juve\.de|anwaltverein\.de|dav\.de|forum-institut\.de|euroforum\.de|beck-akademie\.de|dai\.de|bitkom\.org|handelsblatt\.com|uni-.*\.de|beck-shop\.de|hsu-bund\.de|dfv\.de)/i;

export function prefilter(urls: string[]): string[] {
  return Array.from(new Set(urls)).filter(s => {
    try {
      const u = new URL(s);
      if (DOMAIN_BLOCK.some(rx => rx.test(s))) return false;
      if (PATH_BLOCK.some(rx => rx.test(u.pathname))) return false;
      // Keep if allowlist or event-like signals
      return ALLOWLIST.test(s) || EVENT_HINT.test(s);
    } catch { return false; }
  });
}
