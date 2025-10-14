export type VenueResolution = {
  city?: string;
  country?: string;
  confidence: 'high' | 'low';
};

const LOCATION_ALIASES: Record<string, { city: string; country: string }> = {
  berlin: { city: 'Berlin', country: 'DE' },
  munich: { city: 'Munich', country: 'DE' },
  frankfurt: { city: 'Frankfurt', country: 'DE' },
  hamburg: { city: 'Hamburg', country: 'DE' },
  stuttgart: { city: 'Stuttgart', country: 'DE' },
  brussels: { city: 'Brussels', country: 'BE' },
  luxembourg: { city: 'Luxembourg', country: 'LU' },
  "luxembourg city": { city: 'Luxembourg', country: 'LU' },
  interlaken: { city: 'Interlaken', country: 'CH' },
  "brussels marriott hotel grand place": { city: 'Brussels', country: 'BE' },
  paris: { city: 'Paris', country: 'FR' },
  amsterdam: { city: 'Amsterdam', country: 'NL' },
  vienna: { city: 'Vienna', country: 'AT' },
  lisbon: { city: 'Lisbon', country: 'PT' },
  porto: { city: 'Porto', country: 'PT' },
  brusselsairport: { city: 'Brussels', country: 'BE' },
  zurich: { city: 'Zurich', country: 'CH' },
};

const CITY_PATTERN = new RegExp(`\\b(${Object.keys(LOCATION_ALIASES).join('|')})\\b`, 'i');
const EU_PATTERN = /\b(europe|eu(?:ropean)?(?:\s+union)?)\b/i;

export function resolveVenueCountry(text: string | null | undefined, tld?: string): VenueResolution {
  if (!text) return { confidence: 'low' };
  const lower = text.toLowerCase();

  const cityMatch = lower.match(CITY_PATTERN)?.[1];
  if (cityMatch) {
    const normalized = LOCATION_ALIASES[cityMatch.toLowerCase()];
    return { ...normalized, confidence: 'high' };
  }

  if (EU_PATTERN.test(lower)) {
    return { country: 'EU', confidence: 'low' };
  }

  if (tld) {
    if (tld.endsWith('.de')) return { country: 'DE', confidence: 'low' };
    if (tld.endsWith('.fr')) return { country: 'FR', confidence: 'low' };
    if (tld.endsWith('.nl')) return { country: 'NL', confidence: 'low' };
    if (tld.endsWith('.be')) return { country: 'BE', confidence: 'low' };
    if (tld.endsWith('.eu')) return { country: 'EU', confidence: 'low' };
  }

  return { confidence: 'low' };
}
