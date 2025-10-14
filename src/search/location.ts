import { getCountryContext } from '@/lib/utils/country';
import { toISO2Country } from '@/lib/utils/country';

export type VenueResolution = {
  city?: string;
  country?: string;
  confidence: 'high' | 'low';
};

const EU_PATTERN = /\b(europe|eu(?:ropean)?(?:\s+union)?)\b/i;
const CITY_COUNTRY_PATTERN = /([A-Z][A-Za-z\s]+?),?\s+(Germany|France|Netherlands|Belgium|Switzerland|United Kingdom|Spain|Italy|Luxembourg|Portugal|Austria|Poland|Czech Republic|Hungary|Sweden|Norway|Finland|Denmark)/i;
const JSON_CITY_PATTERN = /("addressLocality"\s*:\s*"([^"]+)")/i;
const JSON_COUNTRY_PATTERN = /("addressCountry"\s*:\s*"([^"]+)")/i;

export function resolveVenueCountry(text: string | null | undefined, tld?: string, rawCountry?: string | null): VenueResolution {
  if (!text) return { confidence: 'low' };

  const jsonCountry = extractJsonCountry(text);
  if (jsonCountry) {
    return { country: jsonCountry.country, city: jsonCountry.city, confidence: 'high' };
  }

  const contextualCountry = inferFromContext(rawCountry);
  if (contextualCountry) {
    return { country: contextualCountry, confidence: 'high' };
  }

  const cityCountry = extractCityCountry(text);
  if (cityCountry) {
    return cityCountry;
  }

  if (EU_PATTERN.test(text)) {
    return { country: 'EU', confidence: 'low' };
  }

  const tldCountry = inferFromTld(tld);
  if (tldCountry) {
    return { country: tldCountry, confidence: 'low' };
  }

  return { confidence: 'low' };
}

function extractJsonCountry(text: string): { city?: string; country: string } | null {
  const countryMatch = text.match(JSON_COUNTRY_PATTERN);
  if (countryMatch && countryMatch[2]) {
    const iso = toISO2Country(countryMatch[2]);
    const cityMatch = text.match(JSON_CITY_PATTERN);
    return { country: iso ?? countryMatch[2], city: cityMatch?.[2] };
  }
  return null;
}

function extractCityCountry(text: string): VenueResolution | null {
  const match = text.match(CITY_COUNTRY_PATTERN);
  if (!match) return null;
  const city = match[1]?.trim();
  const countryIso = toISO2Country(match[2]) ?? match[2];
  return { city, country: countryIso, confidence: 'high' };
}

function inferFromContext(rawCountry?: string | null): string | null {
  if (!rawCountry) return null;
  const context = getCountryContext(rawCountry);
  return context.iso2;
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
