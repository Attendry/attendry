export type CountryContext = {
  iso2: string;
  locale: 'de' | 'en';
  tld: string;
  inPhrase: string;
  countryNames: string[];
  cities: string[];
  negativeSites: string[];
  locationTokens: string[];
  locationTerms?: string[];
};

const COUNTRY_ALIAS_MAP: Record<string, string> = {
  DE: 'DE',
  GERMANY: 'DE',
  DEUTSCHLAND: 'DE',
  FR: 'FR',
  FRANCE: 'FR',
  FRANKREICH: 'FR',
  NL: 'NL',
  NETHERLANDS: 'NL',
  NIEDERLANDE: 'NL',
  HOLLAND: 'NL',
  GB: 'GB',
  UK: 'GB',
  UNITEDKINGDOM: 'GB',
  GREATBRITAIN: 'GB',
  ENGLAND: 'GB',
  ES: 'ES',
  SPAIN: 'ES',
  ESPANA: 'ES',
  ESPAÑA: 'ES',
  IT: 'IT',
  ITALY: 'IT',
  ITALIA: 'IT',
};

export const COUNTRY_CONFIG: Record<string, CountryContext> = {
  FR: {
    iso2: 'FR',
    locale: 'en',
    tld: '.fr',
    inPhrase: '"in France" OR "en France"',
    countryNames: ['France', 'FR', 'Republique francaise', 'Frankreich'],
    cities: ['Paris', 'Lyon', 'Marseille', 'Lille', 'Toulouse', 'Bordeaux', 'Nantes', 'Strasbourg', 'Nice', 'Rennes'],
    negativeSites: ['-reddit', '-jeuxvideo', '-forum', '-mumsnet'],
    locationTokens: ['France', 'Français', 'French', 'Paris', 'Lyon', 'Marseille', 'Hexagone'],
    locationTerms: ['France', 'Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse'],
  },
  DE: {
    iso2: 'DE',
    locale: 'de',
    tld: '.de',
    inPhrase: '"in Germany" OR "in Deutschland"',
    countryNames: ['Germany', 'Deutschland', 'DE', 'Bundesrepublik'],
    cities: ['Berlin', 'München', 'Frankfurt', 'Hamburg', 'Köln', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Hannover', 'Nürnberg'],
    negativeSites: ['-reddit', '-Mumsnet', '-forum'],
    locationTokens: ['Germany', 'Deutschland', 'German', 'Deutsch', 'Berlin', 'Frankfurt', 'Hamburg', 'München', 'Munich'],
    locationTerms: ['Germany', 'Deutschland', 'Berlin', 'Frankfurt', 'Hamburg', 'München', 'Munich', 'Köln', 'Cologne'],
  },
  NL: {
    iso2: 'NL',
    locale: 'en',
    tld: '.nl',
    inPhrase: '"in Netherlands" OR "in Nederland"',
    countryNames: ['Netherlands', 'Nederland', 'NL', 'Holland'],
    cities: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven', 'Groningen', 'The Hague', 'Tilburg', 'Almere', 'Breda', 'Nijmegen'],
    negativeSites: ['-reddit', '-forum'],
    locationTokens: ['Netherlands', 'Nederland', 'Dutch', 'Holland', 'Amsterdam', 'Rotterdam'],
    locationTerms: ['Netherlands', 'Nederland', 'Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague'],
  },
  GB: {
    iso2: 'GB',
    locale: 'en',
    tld: '.uk',
    inPhrase: '"in United Kingdom" OR "in UK" OR "in England"',
    countryNames: ['United Kingdom', 'UK', 'Great Britain', 'GB'],
    cities: ['London', 'Manchester', 'Birmingham', 'Glasgow', 'Edinburgh', 'Liverpool', 'Leeds', 'Bristol', 'Cardiff', 'Belfast'],
    negativeSites: ['-reddit', '-Mumsnet', '-forum'],
    locationTokens: ['United Kingdom', 'Britain', 'British', 'England', 'London', 'Manchester', 'Scotland'],
    locationTerms: ['United Kingdom', 'London', 'Manchester', 'Birmingham', 'Glasgow', 'Edinburgh'],
  },
  ES: {
    iso2: 'ES',
    locale: 'en',
    tld: '.es',
    inPhrase: '"in Spain" OR "en Espana"',
    countryNames: ['Spain', 'Espana', 'ES', 'Reino de Espana'],
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Zaragoza', 'Malaga', 'Murcia', 'Granada', 'Valladolid'],
    negativeSites: ['-reddit', '-foros', '-foro', '-burbuja'],
    locationTokens: ['Spain', 'España', 'Spanish', 'Madrid', 'Barcelona', 'Castilla'],
    locationTerms: ['Spain', 'España', 'Madrid', 'Barcelona', 'Valencia', 'Sevilla'],
  },
  IT: {
    iso2: 'IT',
    locale: 'en',
    tld: '.it',
    inPhrase: '"in Italy" OR "in Italia"',
    countryNames: ['Italy', 'Italia', 'IT', 'Repubblica Italiana'],
    cities: ['Roma', 'Milano', 'Torino', 'Napoli', 'Bologna', 'Firenze', 'Genova', 'Venezia', 'Verona', 'Palermo'],
    negativeSites: ['-reddit', '-forum'],
    locationTokens: ['Italy', 'Italia', 'Italian', 'Rome', 'Milan', 'Milano', 'Turin'],
    locationTerms: ['Italy', 'Italia', 'Rome', 'Milan', 'Milano', 'Turin', 'Torino', 'Bologna'],
  },
};

export function toISO2Country(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === 'EU') return 'EU';
  if (upper.length === 2 && COUNTRY_CONFIG[upper]) return upper;
  const aliasKey = upper.replace(/[^A-Z]/g, '');
  if (COUNTRY_CONFIG[aliasKey]) return aliasKey;
  const alias = COUNTRY_ALIAS_MAP[aliasKey];
  if (alias && COUNTRY_CONFIG[alias]) return alias;
  if (upper.length === 2) return upper; // allow ISO2 even if config missing (validated separately)
  return null;
}

export function getCountryContext(raw?: string | null): CountryContext {
  const iso2 = toISO2Country(raw) ?? 'DE';
  return COUNTRY_CONFIG[iso2] ?? COUNTRY_CONFIG.DE;
}

const COUNTRY_LOCALE_MAP: Record<string, string> = {
  FR: 'fr',
  DE: 'de',
  NL: 'nl',
  GB: 'en',
  CH: 'de',
  AT: 'de',
  ES: 'es',
  IT: 'it',
  BE: 'fr',
};

export function deriveLocale(countryIso2?: string | null, override?: string | null): 'de' | 'en' {
  const explicit = override?.trim();
  if (explicit && (explicit === 'de' || explicit === 'en')) return explicit;
  const iso = toISO2Country(countryIso2 ?? undefined);
  if (!iso || iso === 'EU') return 'en';
  const contextLocale = COUNTRY_CONFIG[iso]?.locale;
  if (contextLocale === 'de' || contextLocale === 'en') return contextLocale;
  const mapped = COUNTRY_LOCALE_MAP[iso];
  if (mapped === 'de' || mapped === 'en') return mapped;
  return 'en';
}

export function isValidISO2Country(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const iso = toISO2Country(value);
  return !!iso && iso.length === 2;
}

