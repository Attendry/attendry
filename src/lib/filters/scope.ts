/**
 * Geographic and temporal scope filtering
 * Enforces country and date boundaries for events
 */

/**
 * German cities gazetteer (major cities)
 */
const GERMAN_CITIES = new Set([
  // Major cities
  'berlin', 'hamburg', 'münchen', 'munich', 'köln', 'cologne', 'frankfurt',
  'stuttgart', 'düsseldorf', 'dortmund', 'essen', 'leipzig', 'bremen',
  'dresden', 'hannover', 'nürnberg', 'nuremberg', 'duisburg', 'bochum',
  'wuppertal', 'bonn', 'bielefeld', 'mannheim', 'karlsruhe', 'münster',
  'wiesbaden', 'augsburg', 'aachen', 'mönchengladbach', 'gelsenkirchen',
  'braunschweig', 'chemnitz', 'kiel', 'halle', 'magdeburg', 'freiburg',
  'krefeld', 'lübeck', 'oberhausen', 'erfurt', 'mainz', 'rostock',
  
  // Common misspellings/variations
  'muenchen', 'koeln', 'duesseldorf', 'nuernberg', 'moenchengladbach'
]);

/**
 * Check if a city is in Germany
 */
export function isGermanCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const normalized = city.trim().toLowerCase();
  return GERMAN_CITIES.has(normalized);
}

/**
 * Check if country code matches Germany
 */
export function isGermany(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  const normalized = countryCode.trim().toUpperCase();
  return normalized === 'DE' || normalized === 'DEU' || normalized === 'GERMANY';
}

/**
 * Check if date is within range
 */
export function isDateInRange(
  eventDate: string | Date | null | undefined,
  rangeStart: string | Date,
  rangeEnd: string | Date
): boolean {
  if (!eventDate) return false;
  
  try {
    const date = typeof eventDate === 'string' ? new Date(eventDate) : eventDate;
    const start = typeof rangeStart === 'string' ? new Date(rangeStart) : rangeStart;
    const end = typeof rangeEnd === 'string' ? new Date(rangeEnd) : rangeEnd;
    
    // Add some tolerance (events starting within 7 days after range end are OK)
    const endTolerance = new Date(end);
    endTolerance.setDate(endTolerance.getDate() + 7);
    
    return date >= start && date <= endTolerance;
  } catch {
    return false;
  }
}

/**
 * Parse date from various German and ISO formats
 */
export function parseEventDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim();
  
  // ISO format: 2025-11-12
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(trimmed);
  }
  
  // German format: 12.11.2025 or 12.11.25
  const germanMatch = trimmed.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (germanMatch) {
    let year = parseInt(germanMatch[3]);
    if (year < 100) {
      year += 2000; // Assume 2000s for 2-digit years
    }
    const month = parseInt(germanMatch[2]) - 1; // JS months are 0-indexed
    const day = parseInt(germanMatch[1]);
    return new Date(year, month, day);
  }
  
  // US format: 11/12/2025
  const usMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    return new Date(`${usMatch[3]}-${usMatch[1]}-${usMatch[2]}`);
  }
  
  // Try natural parsing as fallback
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {
    // Fall through
  }
  
  return null;
}

export interface ScopeFilter {
  countryCode?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  allowGlobalLists?: boolean; // Whether to allow global list pages
}

export interface EventMetadata {
  url: string;
  title?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

/**
 * Check if event passes scope filter
 */
export function passesScope(
  event: EventMetadata,
  filter: ScopeFilter
): { passes: boolean; reason: string } {
  
  // 1. Check if it's a global list page
  const isGlobalList = /\/(events?|calendar|conferences?|veranstaltungen)\/?$/i.test(event.url) ||
                       /(upcoming|past|archive|all-events)/i.test(event.url);
  
  if (isGlobalList && !filter.allowGlobalLists) {
    return {
      passes: false,
      reason: 'Global list/aggregator page excluded by scope filter'
    };
  }
  
  // 2. Check country scope
  if (filter.countryCode) {
    const hasValidCountry = isGermany(event.countryCode) || isGermany(event.country);
    const hasGermanCity = isGermanCity(event.city);
    
    // Must have Germany country OR German city AND no conflicting country
    if (!hasValidCountry && !hasGermanCity) {
      return {
        passes: false,
        reason: `Country/city mismatch: ${event.country || event.countryCode || 'unknown'}, ${event.city || 'unknown'}`
      };
    }
    
    // If has non-German country but German city, reject (conflicting signals)
    if (event.country && !isGermany(event.country) && hasGermanCity) {
      return {
        passes: false,
        reason: `Conflicting location: German city "${event.city}" but country "${event.country}"`
      };
    }
  }
  
  // 3. Check date scope
  if (filter.dateFrom && filter.dateTo) {
    const startDate = parseEventDate(event.startDate);
    const endDate = parseEventDate(event.endDate);
    
    // Check if either start or end date is in range
    const startInRange = startDate && isDateInRange(startDate, filter.dateFrom, filter.dateTo);
    const endInRange = endDate && isDateInRange(endDate, filter.dateFrom, filter.dateTo);
    
    if (!startInRange && !endInRange) {
      // If no dates found, allow it (will be filtered later if truly invalid)
      if (!startDate && !endDate) {
        return {
          passes: true,
          reason: 'No dates found, allowing for later validation'
        };
      }
      
      return {
        passes: false,
        reason: `Date out of range: ${startDate?.toISOString().split('T')[0] || 'unknown'} not in ${filter.dateFrom} to ${filter.dateTo}`
      };
    }
  }
  
  return {
    passes: true,
    reason: 'Passes all scope checks'
  };
}

/**
 * Extract location metadata from content using heuristics
 */
export function extractLocationMetadata(content: string): {
  city: string | null;
  country: string | null;
  countryCode: string | null;
} {
  const contentLower = content.toLowerCase();
  
  // Try schema.org markup
  const addressLocalityMatch = content.match(/"addressLocality"\s*:\s*"([^"]+)"/i) ||
                                content.match(/itemprop="addressLocality"[^>]*>([^<]+)</i);
  const addressCountryMatch = content.match(/"addressCountry"\s*:\s*"([^"]+)"/i) ||
                              content.match(/itemprop="addressCountry"[^>]*>([^<]+)</i);
  
  let city = addressLocalityMatch ? addressLocalityMatch[1].trim() : null;
  let country = addressCountryMatch ? addressCountryMatch[1].trim() : null;
  
  // Fallback: look for German city names
  if (!city) {
    for (const germanCity of GERMAN_CITIES) {
      if (contentLower.includes(germanCity)) {
        city = germanCity;
        country = 'Germany';
        break;
      }
    }
  }
  
  // Determine country code
  let countryCode: string | null = null;
  if (country) {
    if (isGermany(country)) {
      countryCode = 'DE';
    }
  } else if (city && isGermanCity(city)) {
    country = 'Germany';
    countryCode = 'DE';
  }
  
  return { city, country, countryCode };
}

