/**
 * URL Filters
 * 
 * Pre-filter URLs to kill obvious noise before extraction
 */

export function prefilter(input: string[]): string[] {
  const DOMAIN_BLOCK = [/digamextra\.com/i, /fintech\.global/i, /famnit\.upr\.si/i];
  const PATH_BLOCK = [/\/tag\//i, /\/news\//i, /\/category\//i, /\/blog\//i];

  const EVENT_HINT = /(veranstalt|konferenz|kongress|tagung|seminar|workshop|symposium|summit|termine|events?)/i;
  const ALLOWLIST = /(juve\.de|anwaltverein\.de|dav\.de|forum-institut\.de|euroforum\.de|beck-akademie\.de|beck-shop\.de|bitkom\.org|handelsblatt\.com|uni-.*\.de|beck-community\.de)/i;

  return Array.from(new Set(input)).filter(u => {
    try {
      const url = new URL(u);
      if (DOMAIN_BLOCK.some(rx => rx.test(u))) return false;
      if (PATH_BLOCK.some(rx => rx.test(url.pathname))) return false;
      return ALLOWLIST.test(u) || EVENT_HINT.test(u);
    } catch { return false; }
  });
}
