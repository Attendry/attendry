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

// Academic paper and research domains - these are NOT event pages
export const ACADEMIC_DOMAINS: string[] = [
  'ieeexplore.ieee.org',
  'www.ieeexplore.ieee.org',
  'pubmed.ncbi.nlm.nih.gov',
  'www.pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'www.ncbi.nlm.nih.gov',
  'researchgate.net',
  'www.researchgate.net',
  'sciencedirect.com',
  'www.sciencedirect.com',
  'arxiv.org',
  'www.arxiv.org',
  'acm.org',
  'www.acm.org',
  'dl.acm.org',
  'www.dl.acm.org',
  'springer.com',
  'www.springer.com',
  'link.springer.com',
  'www.link.springer.com',
  'nature.com',
  'www.nature.com',
  'science.org',
  'www.science.org'
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

/**
 * Speaker-related terms for multi-language support
 * Used to enhance queries for sales outreach (finding events with speakers)
 */
export const SPEAKER_TERMS: Record<string, string[]> = {
  'en': ['speakers', 'presenters', 'panelists', 'keynotes', 'agenda', 'program', 'lineup'],
  'de': ['referenten', 'vortragende', 'sprecher', 'agenda', 'programm', 'fachprogramm', 'referentenliste'],
  'fr': ['conférenciers', 'intervenants', 'orateurs', 'agenda', 'programme', 'liste des conférenciers']
};

/**
 * Agenda/program-related terms for multi-language support
 * Used to find events with published agendas and programs
 */
export const AGENDA_TERMS: Record<string, string[]> = {
  'en': ['agenda', 'program', 'schedule', 'lineup', 'speakers list', 'programme'],
  'de': ['agenda', 'programm', 'fachprogramm', 'zeitplan', 'referentenliste', 'ablauf'],
  'fr': ['agenda', 'programme', 'horaire', 'liste des conférenciers', 'planning']
};

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


