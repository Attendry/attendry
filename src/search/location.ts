import { getCountryContext, toISO2Country } from '@/lib/utils/country';
import { getLLMGeoResolution } from './llmGeo';

export type VenueResolution = {
  city?: string;
  country?: string;
  confidence: 'high' | 'low';
};

const EU_PATTERN = /\b(europe|eu(?:ropean)?(?:\s+union)?)\b/i;
const JSON_CITY_PATTERN = /"addressLocality"\s*:\s*"([^"]+)"/i;
const JSON_COUNTRY_PATTERN = /"addressCountry"\s*:\s*"([^"]+)"/i;

const geoCache = new Map<string, VenueResolution>();

export async function resolveVenueCountry(
  text: string | null | undefined,
  tld?: string,
  requestedCountry?: string | null,
  url?: string
): Promise<VenueResolution> {
  if (!text) return { confidence: 'low' };
  const cacheKey = `${text}|${tld}|${requestedCountry}`;
  const cached = geoCache.get(cacheKey);
  if (cached) return cached;

  const structured = parseStructured(text);
  if (structured) {
    geoCache.set(cacheKey, structured);
    return structured;
  }

  const llm = await getLLMGeoResolution(text, { tld, requestedCountry, url });
  if (llm) {
    geoCache.set(cacheKey, llm);
    return llm;
  }

  const fallback = inferFromHeuristics(text, tld, requestedCountry);
  geoCache.set(cacheKey, fallback);
  return fallback;
}

function parseStructured(text: string): VenueResolution | null {
  const countryMatch = text.match(JSON_COUNTRY_PATTERN)?.[1];
  if (!countryMatch) return null;
  const cityMatch = text.match(JSON_CITY_PATTERN)?.[1];
  const country = toISO2Country(countryMatch) ?? countryMatch;
  return { country, city: cityMatch, confidence: 'high' };
}

function inferFromHeuristics(text: string, tld?: string, requestedCountry?: string | null): VenueResolution {
  if (EU_PATTERN.test(text)) {
    return { country: 'EU', confidence: 'low' };
  }

  const tldCountry = inferFromTld(tld);
  if (tldCountry) {
    return { country: tldCountry, confidence: 'low' };
  }

  if (requestedCountry) {
    const context = getCountryContext(requestedCountry);
    return { country: context.iso2, confidence: 'low' };
  }

  return { confidence: 'low' };
}

function inferFromTld(tld?: string): string | undefined {
  if (!tld) return undefined;
  if (tld.endsWith('.de')) return 'DE';
  if (tld.endsWith('.fr')) return 'FR';
  if (tld.endsWith('.nl')) return 'NL';
  if (tld.endsWith('.be')) return 'BE';
  if (tld.endsWith('.eu')) return 'EU';
  return undefined;
}

export function clearGeoCache(): void {
  geoCache.clear();
}
