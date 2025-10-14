import { z } from 'zod';

/**
 * Query Object V2 - Strict schema with server-enforced validation
 * 
 * This schema ensures deterministic localisation and prevents client-side manipulation
 * of critical search parameters.
 */

// ISO-3166-1 alpha-2 country codes (required)
const CountryCodeSchema = z.enum([
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
]);

// ISO-3166-2 region codes (optional)
const RegionCodeSchema = z.string().regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/).optional();

// Supported languages
const LanguageSchema = z.enum(['en', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'pt', 'sv', 'da', 'no', 'fi']);

// Search intent types
const IntentSchema = z.enum(['event', 'speaker', 'company', 'topic']);

// Date range schema
const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
}).refine(
  (data) => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  },
  { message: "Start date must be before end date" }
);

// Main Query Object V2 Schema
export const QueryObjectV2Schema = z.object({
  // Core search parameters
  query: z.string()
    .min(1, "Query cannot be empty")
    .max(500, "Query too long")
    .transform((val) => val.trim()),
  
  intent: IntentSchema,
  
  // REQUIRED: Country code (server-enforced)
  country: CountryCodeSchema,
  
  // Optional regional specification
  region: RegionCodeSchema,
  
  // Language preferences (ordered by priority)
  language_pref: z.array(LanguageSchema)
    .min(1, "At least one language preference required")
    .max(5, "Too many language preferences")
    .default(['en']),
  
  // Date range constraints
  date_range: DateRangeSchema.optional(),
  
  // Freshness requirement (days)
  freshness_days: z.number()
    .int("Must be integer")
    .min(1, "Minimum 1 day")
    .max(365, "Maximum 1 year")
    .default(30),
  
  // Domain filtering
  sources_allowlist: z.array(z.string().url("Invalid URL"))
    .max(50, "Too many allowed sources")
    .default([]),
  
  sources_blocklist: z.array(z.string().url("Invalid URL"))
    .max(50, "Too many blocked sources")
    .default([]),
  
  // Result limits
  page_limit: z.number()
    .int("Must be integer")
    .min(1, "Minimum 1 page")
    .max(100, "Maximum 100 pages")
    .default(10),
  
  // User context (for personalization)
  user_id: z.string().uuid("Invalid user ID").nullable().default(null),
  
  // Internal metadata (not user-provided)
  _metadata: z.object({
    correlation_id: z.string().uuid(),
    timestamp: z.string().datetime(),
    version: z.literal('2.0'),
    client_ip: z.string().ip().optional(),
    user_agent: z.string().optional()
  }).optional()
});

export type QueryObjectV2 = z.infer<typeof QueryObjectV2Schema>;

/**
 * Query Normaliser
 * 
 * Performs server-side normalisation to ensure consistent processing:
 * - Lower-cases ISO codes
 * - Strips diacritics for search terms (preserves display)
 * - Collapses whitespace
 * - Logs resolved filters for audit
 */
export class QueryNormaliser {
  private static readonly DIACRITICS_MAP: Record<string, string> = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
    'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i',
    'î': 'i', 'ï': 'i', 'ð': 'd', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o',
    'õ': 'o', 'ö': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'þ': 'th', 'ß': 'ss', 'ÿ': 'y'
  };

  /**
   * Normalise a query object for consistent processing
   */
  static normalise(rawQuery: unknown): QueryObjectV2 {
    // Validate with Zod first
    const validated = QueryObjectV2Schema.parse(rawQuery);
    
    // Apply normalisation transforms
    const normalised: QueryObjectV2 = {
      ...validated,
      query: this.normaliseSearchTerm(validated.query),
      country: validated.country.toLowerCase() as any, // Re-validate after transform
      region: validated.region?.toLowerCase() as any,
      language_pref: validated.language_pref.map(lang => lang.toLowerCase() as any),
      sources_allowlist: validated.sources_allowlist.map(url => this.normaliseUrl(url)),
      sources_blocklist: validated.sources_blocklist.map(url => this.normaliseUrl(url))
    };

    // Log resolved filters for audit trail
    this.logResolvedFilters(normalised);

    return normalised;
  }

  /**
   * Normalise search terms by removing diacritics and collapsing whitespace
   */
  private static normaliseSearchTerm(term: string): string {
    return term
      .split('')
      .map(char => this.DIACRITICS_MAP[char] || char)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalise URLs to canonical form
   */
  private static normaliseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}`;
    } catch {
      return url; // Return as-is if invalid
    }
  }

  /**
   * Log resolved filters for audit and debugging
   */
  private static logResolvedFilters(query: QueryObjectV2): void {
    console.log(JSON.stringify({
      at: 'query_normalisation',
      correlation_id: query._metadata?.correlation_id,
      resolved_filters: {
        country: query.country,
        region: query.region,
        languages: query.language_pref,
        date_range: query.date_range,
        freshness_days: query.freshness_days,
        allowlist_count: query.sources_allowlist.length,
        blocklist_count: query.sources_blocklist.length,
        page_limit: query.page_limit
      },
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Query Builder for Search Engines
 * 
 * Builds search engine specific queries with server-enforced country constraints
 */
export class SearchQueryBuilder {
  /**
   * Build Google CSE query with country constraints
   */
  static buildCSEQuery(query: QueryObjectV2): {
    query: string;
    params: Record<string, string>;
  } {
    const baseQuery = query.query;
    
    // Add country-specific constraints
    const countryConstraints = this.buildCountryConstraints(query.country);
    const finalQuery = `${baseQuery} ${countryConstraints}`.trim();

    const params: Record<string, string> = {
      q: finalQuery,
      gl: query.country.toUpperCase(), // Country bias
      cr: `country${query.country.toUpperCase()}`, // Country restriction
      hl: query.language_pref[0], // Interface language
      num: Math.min(query.page_limit * 10, 100).toString(), // Results per page
      safe: 'off'
    };

    // Add date restrictions if specified
    if (query.date_range?.from || query.date_range?.to) {
      params.tbs = this.buildDateRestriction(query.date_range);
    }

    // Add site restrictions
    if (query.sources_allowlist.length > 0) {
      const siteRestrictions = query.sources_allowlist
        .map(url => `site:${new URL(url).hostname}`)
        .join(' OR ');
      params.q = `${params.q} (${siteRestrictions})`;
    }

    return { query: finalQuery, params };
  }

  /**
   * Build Firecrawl query with location constraints
   */
  static buildFirecrawlQuery(query: QueryObjectV2): {
    query: string;
    options: Record<string, any>;
  } {
    const baseQuery = query.query;
    const countryConstraints = this.buildCountryConstraints(query.country);
    const finalQuery = `${baseQuery} ${countryConstraints}`.trim();

    const options = {
      limit: Math.min(query.page_limit * 10, 100),
      sources: ['web'],
      ignoreInvalidURLs: true,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 800,
        blockAds: true,
        removeBase64Images: true,
        location: {
          country: query.country.toUpperCase(),
          languages: query.language_pref
        }
      }
    };

    return { query: finalQuery, options };
  }

  /**
   * Build country-specific search constraints
   */
  private static buildCountryConstraints(country: string): string {
    const constraints: Record<string, string> = {
      'de': 'site:.de OR "Deutschland" OR "Germany"',
      'fr': 'site:.fr OR "France" OR "français"',
      'gb': 'site:.uk OR "United Kingdom" OR "UK"',
      'us': 'site:.us OR "United States" OR "USA"',
      'nl': 'site:.nl OR "Netherlands" OR "Nederland"',
      'es': 'site:.es OR "Spain" OR "España"',
      'it': 'site:.it OR "Italy" OR "Italia"',
      'ch': 'site:.ch OR "Switzerland" OR "Schweiz"',
      'at': 'site:.at OR "Austria" OR "Österreich"',
      'be': 'site:.be OR "Belgium" OR "België"'
    };

    return constraints[country.toLowerCase()] || `"${country.toUpperCase()}"`;
  }

  /**
   * Build date restriction string for Google CSE
   */
  private static buildDateRestriction(dateRange: { from?: string; to?: string }): string {
    const now = new Date();
    const from = dateRange.from ? new Date(dateRange.from) : null;
    const to = dateRange.to ? new Date(dateRange.to) : null;

    if (from && to) {
      // Custom date range
      const fromDays = Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      const toDays = Math.floor((now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24));
      return `cdr:1,cd_min:${toDays},cd_max:${fromDays}`;
    } else if (from) {
      // From date only
      const days = Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      return `cdr:1,cd_min:0,cd_max:${days}`;
    } else if (to) {
      // To date only
      const days = Math.floor((now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24));
      return `cdr:1,cd_min:${days},cd_max:365`;
    }

    return '';
  }
}
