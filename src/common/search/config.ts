// common/search/config.ts
import { supabaseAdmin } from '../../lib/supabase-admin';

export type ActiveConfig = {
  id: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms?: string;
  eventTerms?: string[];
  defaultCountries?: string[];
  euCountries?: string[];
  euLocationTerms?: Record<string, string[]>;
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
  "general": {
    id: 'default',
    name: "General Business",
    industry: 'general',
    baseQuery: "(conference OR event OR summit OR workshop OR seminar OR meeting OR symposium OR forum OR exhibition OR trade show OR convention OR congress OR webinar OR meetup OR networking event OR masterclass OR roundtable OR panel discussion OR expo)",
    excludeTerms: "reddit Mumsnet forum",
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
    euLocationTerms: {
      en: ['Europe', 'European Union', 'EU', 'Central Europe', 'Western Europe', 'Eastern Europe'],
      de: ['Europa', 'Europäische Union', 'EU', 'Mitteleuropa', 'Westeuropa', 'Osteuropa'],
      fr: ['Europe', 'Union européenne', 'UE', 'Europe centrale', 'Europe occidentale', 'Europe orientale']
    },
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
      DE: [
        'Berlin', 'München', 'Munich', 'Frankfurt', 'Hamburg', 'Köln', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Duesseldorf',
        'Leipzig', 'Hannover', 'Hanover', 'Nürnberg', 'Nuremberg', 'Bremen', 'Bonn', 'Essen', 'Mannheim', 'Münster', 'Munster',
        'Wiesbaden', 'Dresden', 'Dortmund', 'Bochum', 'Karlsruhe', 'Aachen', 'Braunschweig', 'Chemnitz', 'Freiburg', 'Heidelberg'
      ],
      AT: ['Wien', 'Vienna', 'Salzburg', 'Graz', 'Innsbruck', 'Linz', 'Klagenfurt'],
      CH: ['Zürich', 'Zurich', 'Bern', 'Basel', 'Genf', 'Geneva', 'Lausanne', 'Lugano', 'St. Gallen'],
      FR: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux', 'Nantes', 'Lille'],
      IT: ['Roma', 'Rome', 'Milano', 'Milan', 'Torino', 'Turin', 'Firenze', 'Florence', 'Bologna', 'Napoli', 'Naples'],
      ES: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Seville', 'Bilbao', 'Zaragoza', 'Malaga'],
      NL: ['Amsterdam', 'Rotterdam', 'Den Haag', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen'],
      BE: ['Brussels', 'Bruxelles', 'Antwerp', 'Gent', 'Ghent', 'Brugge', 'Bruges']
    },
    disqualifyCountryTerms: ['United States', 'USA', 'US', 'Canada', 'United Kingdom', 'UK'],
    disqualifyCityTerms: ['Kansas City', 'Nashville', 'Houston', 'Chicago', 'New York', 'Los Angeles', 'San Francisco', 'Boston', 'Atlanta', 'Miami', 'Seattle', 'Denver']
  },
  "legal-compliance": {
    id: 'legal-compliance',
    name: "Legal & Compliance",
    industry: 'legal-compliance',
    baseQuery: "(legal OR compliance OR investigation OR \"e-discovery\" OR ediscovery OR \"legal tech\" OR \"legal technology\" OR \"regulatory\" OR \"governance\" OR \"risk management\" OR \"audit\" OR \"whistleblowing\" OR \"data protection\" OR \"GDPR\" OR \"privacy\" OR \"cybersecurity\" OR \"regtech\" OR \"ESG\" OR recht OR rechtskonformität OR regelkonformität OR \"rechtliche technologie\" OR \"recht tech\" OR \"datenschutz\" OR \"hinweisgeberschutz\" OR \"geldwäsche\" OR sanktionen OR \"interne untersuchung\" OR \"compliance management\")",
    excludeTerms: "reddit Mumsnet \"legal advice\" forum",
    eventTerms: [
      'conference', 'event', 'summit', 'workshop', 'seminar', 'meeting', 'symposium', 'forum',
      'exhibition', 'trade show', 'convention', 'congress', 'webinar', 'meetup', 'bootcamp',
      'hackathon', 'networking event', 'masterclass', 'roundtable', 'panel discussion', 'expo'
    ],
    defaultCountries: ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE'],
    euCountries: ['DE', 'AT', 'CH', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'IE', 'PT', 'GR'],
    euLocationTerms: {
      en: ['Europe', 'European Union', 'EU', 'Central Europe', 'Western Europe', 'Eastern Europe'],
      de: ['Europa', 'Europäische Union', 'EU', 'Mitteleuropa', 'Westeuropa', 'Osteuropa'],
      fr: ['Europe', 'Union européenne', 'UE', 'Europe centrale', 'Europe occidentale', 'Europe orientale']
    },
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
      DE: [
        'Berlin', 'München', 'Munich', 'Frankfurt', 'Hamburg', 'Köln', 'Cologne', 'Stuttgart', 'Düsseldorf', 'Duesseldorf',
        'Leipzig', 'Hannover', 'Hanover', 'Nürnberg', 'Nuremberg', 'Bremen', 'Bonn', 'Essen', 'Mannheim', 'Münster', 'Munster',
        'Wiesbaden', 'Dresden', 'Dortmund', 'Bochum', 'Karlsruhe', 'Aachen', 'Braunschweig', 'Chemnitz', 'Freiburg', 'Heidelberg'
      ],
      AT: ['Wien', 'Vienna', 'Salzburg', 'Graz', 'Innsbruck', 'Linz', 'Klagenfurt'],
      CH: ['Zürich', 'Zurich', 'Bern', 'Basel', 'Genf', 'Geneva', 'Lausanne', 'Lugano', 'St. Gallen'],
      FR: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Bordeaux', 'Nantes', 'Lille'],
      IT: ['Roma', 'Rome', 'Milano', 'Milan', 'Torino', 'Turin', 'Firenze', 'Florence', 'Bologna', 'Napoli', 'Naples'],
      ES: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Seville', 'Bilbao', 'Zaragoza', 'Malaga'],
      NL: ['Amsterdam', 'Rotterdam', 'Den Haag', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen'],
      BE: ['Brussels', 'Antwerpen', 'Antwerp', 'Gent', 'Ghent', 'Brugge', 'Bruges', 'Leuven', 'Liège']
    },
    disqualifyCountryTerms: ['USA', 'United States', 'America', 'Canada', 'Australia', 'New Zealand', 'Japan', 'China', 'India', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'South Africa', 'Nigeria', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'Libya', 'Sudan', 'Ethiopia', 'Kenya', 'Ghana', 'Senegal', 'Ivory Coast', 'Cameroon', 'Angola', 'Mozambique', 'Madagascar', 'Tanzania', 'Uganda', 'Rwanda', 'Burundi', 'Malawi', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia', 'Lesotho', 'Swaziland', 'Seychelles', 'Mauritius', 'Comoros', 'Djibouti', 'Somalia', 'Eritrea', 'Central African Republic', 'Chad', 'Niger', 'Mali', 'Burkina Faso', 'Guinea', 'Sierra Leone', 'Liberia', 'Gambia', 'Guinea-Bissau', 'Cape Verde', 'São Tomé and Príncipe', 'Equatorial Guinea', 'Gabon', 'Republic of the Congo', 'Democratic Republic of the Congo', 'Congo', 'Congo-Kinshasa', 'Congo-Brazzaville', 'Congo Republic', 'Congo Democratic Republic', 'DRC', 'DR Congo', 'Zaire', 'Congo Free State', 'Belgian Congo', 'French Congo', 'Portuguese Congo', 'Spanish Congo', 'German Congo', 'British Congo', 'Italian Congo', 'Dutch Congo', 'Swedish Congo', 'Norwegian Congo', 'Danish Congo', 'Finnish Congo', 'Polish Congo', 'Czech Congo', 'Hungarian Congo', 'Romanian Congo', 'Bulgarian Congo', 'Croatian Congo', 'Slovenian Congo', 'Slovak Congo', 'Lithuanian Congo', 'Latvian Congo', 'Estonian Congo', 'Luxembourg Congo', 'Maltese Congo', 'Cypriot Congo', 'Irish Congo', 'Portuguese Congo', 'Greek Congo'],
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
      const euLocationTerms = toRecord(cfg.euLocationTerms || cfg.eu_location_terms);
      const locationTermsByCountry = toRecord(cfg.locationTermsByCountry || cfg.location_terms_by_country);
      const cityKeywordsByCountry = toRecord(cfg.cityKeywordsByCountry || cfg.city_keywords_by_country);
      const disqualifyCountryTerms = toArray(cfg.disqualifyCountryTerms || cfg.disqualify_country_terms);
      const disqualifyCityTerms = toArray(cfg.disqualifyCityTerms || cfg.disqualify_city_terms);
      cached = { 
        id: cfg.id || '',
        name: cfg.name || '',
        industry: cfg.industry || '',
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
