/**
 * URL Filters
 * 
 * Filter out junk before extraction
 */

export function prefilter(input: string[]): string[] {
  const BLOCK_DOMAIN = [/digamextra\.com/i, /fintech\.global/i, /famnit\.upr\.si/i];
  const BLOCK_PATH = [/\/tag\//i, /\/news\//i, /\/category\//i, /\/blog\//i];
  const EVENT_HINT = /(veranstalt|konferenz|kongress|tagung|seminar|workshop|symposium|summit|termine|events?)/i;
  const ALLOW = /(juve\.de|anwaltverein\.de|dav\.de|forum-institut\.de|euroforum\.de|beck-akademie\.de|beck-shop\.de|bitkom\.org|beck-community\.de|uni-.*\.de|handelsblatt\.com)/i;

  return Array.from(new Set(input)).filter(u => {
    try {
      const url = new URL(u);
      if (BLOCK_DOMAIN.some(rx => rx.test(u))) return false;
      if (BLOCK_PATH.some(rx => rx.test(url.pathname))) return false;
      return ALLOW.test(u) || EVENT_HINT.test(u);
    } catch { return false; }
  });
}
