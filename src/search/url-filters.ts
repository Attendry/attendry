/**
 * URL Filters
 * 
 * Filter out junk before extraction
 */

export function prefilter(input: string[]): string[] {
  const BLOCK_DOMAIN = [
    /digamextra\.com/i,
    /fintech\.global/i,
    /famnit\.upr\.si/i,
    /eventbrite\.com/i,          // usually non-DE and noisy
    /oxnardcollege\.edu/i,
    /marincounty\.gov/i,
    /calrecycle\.ca\.gov/i,
    /nist\.gov/i, /cisa\.gov/i,  // US federal
  ];

  const BLOCK_PATH = [/\/tag\//i, /\/category\//i, /\/blog\//i, /\/news\//i];

  const EVENT_HINT = /(veranstalt|konferenz|kongress|tagung|seminar|workshop|symposium|forum|termine|events?)/i;

  const ALLOW = [
    /juve\.de/i,
    /anwaltverein\.de/i, /dav\.de/i,
    /forum-institut\.de/i,
    /euroforum\.de/i,
    /beck-akademie\.de/i, /beck-shop\.de/i, /beck-community\.de/i,
    /bitkom\.org/i,
    /\.uni-.*\.de/i, /uni-.*\.de/i, /fh-.*\.de/i,
    /handelsblatt\.com/i, /compliance-magazin\.de/i, /datenschutzkonferenz-online\.de/i,
    /\.de\//i,                       // generic .de fallback
  ];

  return Array.from(new Set(input)).filter(u => {
    try {
      if (BLOCK_DOMAIN.some(rx => rx.test(u))) return false;
      const url = new URL(u);
      if (BLOCK_PATH.some(rx => rx.test(url.pathname))) return false;
      return ALLOW.some(rx => rx.test(u)) || EVENT_HINT.test(u);
    } catch { return false; }
  });
}
