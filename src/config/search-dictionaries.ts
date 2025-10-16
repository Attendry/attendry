import { COUNTRY_CONFIG } from '@/lib/utils/country';

export const EVENT_KEYWORDS: string[] = [
  'conference',
  'summit',
  'event',
  'workshop',
  'seminar',
  'exhibition',
  'trade show',
  'convention',
  'symposium',
  'meeting',
  'forum',
  'expo',
  'showcase',
  'networking',
  'training',
  'webinar',
  'kongress',
  'veranstaltung',
  'fachkonferenz',
  'tagung',
  'messe',
  'netzwerk',
  'fortbildung'
];

export const SOCIAL_DOMAINS: string[] = [
  'instagram.com',
  'www.instagram.com',
  'facebook.com',
  'www.facebook.com',
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'linkedin.com',
  'www.linkedin.com',
  'youtube.com',
  'www.youtube.com',
  'tiktok.com',
  'www.tiktok.com',
  'reddit.com',
  'www.reddit.com'
];

export const DEFAULT_SHARD_KEYWORDS: string[] = [
  'conference',
  'summit',
  'event',
  'workshop',
  'seminar',
  'meeting',
  'symposium',
  'forum',
  'exhibition'
];

export function getCountryLocations(iso2?: string | null): {
  countryNames: string[];
  cities: string[];
  locationTokens: string[];
  locale: 'de' | 'en';
} | null {
  if (!iso2) return null;
  const context = COUNTRY_CONFIG[iso2.toUpperCase()];
  if (!context) return null;
  return {
    countryNames: context.countryNames,
    cities: context.cities,
    locationTokens: context.locationTokens,
    locale: context.locale
  };
}

export function detectCountryFromText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const context of Object.values(COUNTRY_CONFIG)) {
    if (
      context.countryNames.some((name) => lower.includes(name.toLowerCase())) ||
      context.locationTokens.some((token) => lower.includes(token.toLowerCase())) ||
      context.cities.some((city) => lower.includes(city.toLowerCase()))
    ) {
      return context.countryNames[0] ?? context.iso2;
    }
  }
  return null;
}

export function detectCityFromText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const context of Object.values(COUNTRY_CONFIG)) {
    const match = context.cities.find((city) => lower.includes(city.toLowerCase()));
    if (match) {
      return match;
    }
  }
  return null;
}


