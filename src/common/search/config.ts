// common/search/config.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export type ActiveConfig = {
  id: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms?: string;
  eventTerms?: string[];
  defaultCountries?: string[];
  euCountries?: string[];
  euLocationTerms?: string[];
  locationTermsByCountry?: Record<string, string[]>;
  cityKeywordsByCountry?: Record<string, string[]>;
  disqualifyCountryTerms?: string[];
  disqualifyCityTerms?: string[];
  // snake_case mirrors allowed too
  base_query?: string;
  exclude_terms?: string;
};

let cached: ActiveConfig | null = null;

// Helpers to normalise string/JSON inputs coming from config storage
const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item).trim()).filter(Boolean)
        : trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const toRecord = (value: unknown): Record<string, string[]> => {
  if (!value) return {};
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.reduce<Record<string, string[]>>((acc, [key, val]) => {
      const arr = toArray(val);
      if (arr.length) acc[key.toUpperCase()] = arr;
      return acc;
    }, {});
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return toRecord(parsed);
    } catch {
      return {};
    }
  }
  return {};
};

// Default industry templates (same as in the API route)
const INDUSTRY_TEMPLATES: Record<string, ActiveConfig> = {
  "legal-compliance": {
    id: 'default',
    name: "Legal & Compliance",
    industry: 'legal-compliance',
    baseQuery: "(legal OR compliance OR investigation OR \"e-discovery\" OR ediscovery OR \"legal tech\" OR \"legal technology\" OR \"regulatory\" OR \"governance\" OR \"risk management\" OR \"audit\" OR \"whistleblowing\" OR \"data protection\" OR \"GDPR\" OR \"privacy\" OR \"cybersecurity\" OR \"regtech\" OR \"ESG\" OR recht OR rechtskonformität OR regelkonformität OR \"rechtliche technologie\" OR \"recht tech\" OR \"datenschutz\" OR \"hinweisgeberschutz\" OR \"geldwäsche\" OR sanktionen OR \"interne untersuchung\" OR \"compliance management\")",
    excludeTerms: "reddit Mumsnet \"legal advice\" forum",
    eventTerms: [
      'conference',
      'event',
      'summit',
      'workshop',
      'seminar',
      'meeting',
      'symposium',
      'forum',
      'exhibition',
      'trade show',
      'convention',
      'congress'
    ],
    defaultCountries: ['DE'],
    euCountries: ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ', 'HU', 'SK', 'SI', 'HR', 'BG', 'RO', 'EE', 'LV', 'LT', 'MT', 'CY', 'IE', 'PT', 'GR'],
    euLocationTerms: ['Europe', 'European', 'Europa', 'Europäisch', 'EU'],
    locationTermsByCountry: {
      DE: ['Germany', 'Deutschland', 'Berlin', 'München', 'Frankfurt', 'Hamburg', 'Köln', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Hannover', 'Nürnberg'],
      AT: ['Austria', 'Österreich', 'Wien', 'Salzburg', 'Graz', 'Innsbruck'],
      CH: ['Switzerland', 'Schweiz', 'Zürich', 'Bern', 'Basel', 'Genf'],
      FR: ['France', 'Frankreich', 'Paris', 'Lyon', 'Marseille'],
      IT: ['Italy', 'Italien', 'Roma', 'Milano', 'Torino'],
      ES: ['Spain', 'Spanien', 'Madrid', 'Barcelona', 'Valencia'],
      NL: ['Netherlands', 'Niederlande', 'Amsterdam', 'Rotterdam', 'Den Haag'],
      BE: ['Belgium', 'Belgien', 'Brussels', 'Antwerpen', 'Gent']
    },
    cityKeywordsByCountry: {
      DE: ['Berlin', 'München', 'Frankfurt', 'Hamburg', 'Köln', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Hannover', 'Nürnberg', 'Bremen', 'Bonn', 'Essen', 'Mannheim', 'Münster', 'Wiesbaden', 'Dresden'],
      AT: ['Wien', 'Salzburg', 'Graz', 'Innsbruck', 'Linz'],
      CH: ['Zürich', 'Bern', 'Basel', 'Genf', 'Lausanne'],
      FR: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice'],
      IT: ['Roma', 'Milano', 'Torino', 'Firenze', 'Bologna'],
      ES: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'],
      NL: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven'],
      BE: ['Brussels', 'Antwerp', 'Ghent', 'Bruges']
    },
    disqualifyCountryTerms: ['United States', 'USA', 'US', 'Canada', 'United Kingdom', 'UK'],
    disqualifyCityTerms: ['Kansas City', 'Nashville', 'Houston', 'Chicago', 'New York', 'Los Angeles', 'San Francisco', 'Boston', 'Atlanta', 'Miami', 'Seattle', 'Denver']
  }
};

export async function loadActiveConfig(): Promise<ActiveConfig> {
  if (cached) return cached;
  
  try {
    // Try to get configuration from database using admin client
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("search_configurations")
      .select("*")
      .eq("is_active", true)
      .single();
    
    if (!error && data) {
      const cfg = data as Partial<ActiveConfig> & Record<string, unknown>;
      // normalize camelCase first, then fall back to snake_case
      const baseQuery = cfg.baseQuery || cfg.base_query || '';
      const excludeTerms = cfg.excludeTerms || cfg.exclude_terms || '';
      const eventTerms = toArray(cfg.eventTerms || cfg.event_terms);
      const defaultCountries = toArray(cfg.defaultCountries || cfg.default_countries);
      const euCountries = toArray(cfg.euCountries || cfg.eu_countries);
      const euLocationTerms = toArray(cfg.euLocationTerms || cfg.eu_location_terms);
      const locationTermsByCountry = toRecord(cfg.locationTermsByCountry || cfg.location_terms_by_country);
      const cityKeywordsByCountry = toRecord(cfg.cityKeywordsByCountry || cfg.city_keywords_by_country);
      const disqualifyCountryTerms = toArray(cfg.disqualifyCountryTerms || cfg.disqualify_country_terms);
      const disqualifyCityTerms = toArray(cfg.disqualifyCityTerms || cfg.disqualify_city_terms);
      cached = { 
        id: cfg.id,
        name: cfg.name,
        industry: cfg.industry,
        baseQuery,
        excludeTerms,
        eventTerms,
        defaultCountries,
        euCountries,
        euLocationTerms,
        locationTermsByCountry,
        cityKeywordsByCountry,
        disqualifyCountryTerms,
        disqualifyCityTerms
      };
      return cached!;
    }
  } catch (dbError) {
    console.warn('Database not available for search config, using default:', dbError);
  }

  // Fallback to default template
  const defaultTemplate = INDUSTRY_TEMPLATES["legal-compliance"];
  cached = defaultTemplate;
  return cached;
}
