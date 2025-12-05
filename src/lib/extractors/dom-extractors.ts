/**
 * Deterministic DOM-based extraction (before LLM)
 * Uses selectors and patterns to extract speakers and metadata
 */

export interface SpeakerInfo {
  name: string;
  title?: string | null;
  org?: string | null;
  profile_url?: string | null;
}

export interface EventMetadata {
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  city?: string | null;
  country_code?: string | null;
  venue?: string | null;
  url?: string | null;
}

/**
 * Extract speakers from content using selectors and patterns
 */
export function extractSpeakersFromDOM(content: string, baseUrl: string): SpeakerInfo[] {
  const speakers: SpeakerInfo[] = [];
  const seenNames = new Set<string>();
  
  // Common speaker selectors
  const selectors = [
    // Microdata
    /itemprop=["']name["'][^>]*>([^<]+)</gi,
    /itemprop=["']person["'][^>]*>([^<]+)</gi,
    
    // Class-based
    /class=["'][^"']*speaker[^"']*["'][^>]*>([^<]+)</gi,
    /class=["'][^"']*referent[^"']*["'][^>]*>([^<]+)</gi,
    /class=["'][^"']*sprecher[^"']*["'][^>]*>([^<]+)</gi,
    /class=["'][^"']*faculty[^"']*["'][^>]*>([^<]+)</gi,
    
    // Header-based patterns
    /##\s*([A-ZÄÖÜa-zäöüß][a-zäöüß]+\s+[A-ZÄÖÜa-zäöüß][a-zäöüß]+(?:\s+[A-ZÄÖÜa-zäöüß][a-zäöüß]+)?)\s*$/gm,
    
    // List items under speaker sections
    /<li[^>]*>([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)<\/li>/gi
  ];
  
  for (const selector of selectors) {
    let match;
    while ((match = selector.exec(content)) !== null) {
      const rawName = match[1].trim();
      
      // Normalize and validate
      const normalizedName = normalizeName(rawName);
      if (normalizedName && !seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        speakers.push({
          name: normalizedName,
          title: null,
          org: null,
          profile_url: null
        });
      }
    }
  }
  
  return speakers;
}

/**
 * Normalize speaker name
 * - Removes all-caps formatting
 * - Filters out UI labels
 * - Validates format
 */
function normalizeName(raw: string): string | null {
  if (!raw || raw.length < 3) return null;
  
  let name = raw.trim();
  
  // Filter out UI labels and CTAs
  const uiPatterns = [
    /share\s*by/i,
    /posted\s*by/i,
    /written\s*by/i,
    /register/i,
    /learn\s*more/i,
    /read\s*more/i,
    /view\s*profile/i,
    /contact/i
  ];
  
  for (const pattern of uiPatterns) {
    if (pattern.test(name)) return null;
  }
  
  // Convert ALL CAPS to Title Case
  if (name === name.toUpperCase() && name.length > 5) {
    name = toTitleCase(name);
  }
  
  // Must have at least 2 words
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return null;
  
  // Each word should start with capital letter
  const isProperCase = words.every(word => /^[A-ZÄÖÜ]/.test(word));
  if (!isProperCase) return null;
  
  // Should only contain letters, spaces, hyphens, apostrophes, dots
  if (!/^[A-ZÄÖÜa-zäöüß\s\-'.]+$/.test(name)) return null;
  
  // Filter out common non-names
  const nonNames = [
    'privacy', 'policy', 'terms', 'conditions', 'copyright',
    'reserved', 'rights', 'contact', 'about', 'home'
  ];
  
  const nameLower = name.toLowerCase();
  if (nonNames.some(nn => nameLower.includes(nn))) return null;
  
  return name;
}

/**
 * Convert string to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      // Don't capitalize small words unless they're first
      const small = ['von', 'van', 'de', 'der', 'den', 'zu', 'zur'];
      if (small.includes(word)) return word;
      
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Extract event metadata from content using patterns and microdata
 */
export function extractMetadataFromDOM(content: string, pageUrl: string): EventMetadata {
  const metadata: EventMetadata = {
    url: pageUrl
  };
  
  // 1. Extract event name
  // Try schema.org name first
  let nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/i) ||
                  content.match(/itemprop=["']name["'][^>]*>([^<]+)</i) ||
                  content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  
  if (nameMatch) {
    metadata.name = nameMatch[1].trim();
  }
  
  // 2. Extract dates
  const dates = extractDatesFromContent(content);
  if (dates.start) metadata.start_date = dates.start;
  if (dates.end) metadata.end_date = dates.end;
  
  // 3. Extract location
  const location = extractLocationFromContent(content);
  if (location.city) metadata.city = location.city;
  if (location.country_code) metadata.country_code = location.country_code;
  if (location.venue) metadata.venue = location.venue;
  
  return metadata;
}

/**
 * Extract dates from content
 */
function extractDatesFromContent(content: string): { start: string | null; end: string | null } {
  const result = { start: null as string | null, end: null as string | null };
  
  // Try schema.org
  const startDateMatch = content.match(/"startDate"\s*:\s*"([^"]+)"/i) ||
                         content.match(/itemprop=["']startDate["'][^>]*(?:content|datetime)=["']([^"']+)["']/i);
  const endDateMatch = content.match(/"endDate"\s*:\s*"([^"]+)"/i) ||
                       content.match(/itemprop=["']endDate["'][^>]*(?:content|datetime)=["']([^"']+)["']/i);
  
  if (startDateMatch) {
    result.start = normalizeDate(startDateMatch[1]);
  }
  
  if (endDateMatch) {
    result.end = normalizeDate(endDateMatch[1]);
  }
  
  // Try common date patterns if not found
  if (!result.start) {
    // German month names for pattern matching
    const monthNames = '(january|february|march|april|may|june|july|august|september|october|november|december|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)';
    
    // GERMAN DATE FORMAT: "10. Juni 2026" or "10.-11. Juni 2026" (DAY. MONTH YEAR)
    // This is the most common format on German conference websites
    const germanMonthMatch = content.match(new RegExp(`(\\d{1,2})\\.?\\s*(?:[–-]\\s*\\d{1,2}\\.?\\s*)?${monthNames}\\s+(\\d{4})`, 'i'));
    if (germanMonthMatch) {
      const month = parseMonth(germanMonthMatch[2]);
      if (month !== null) {
        result.start = `${germanMonthMatch[3]}-${month.toString().padStart(2, '0')}-${germanMonthMatch[1].padStart(2, '0')}`;
      }
    }
    
    // German numeric format: 12.11.2025 (DD.MM.YYYY)
    if (!result.start) {
      const germanNumericMatch = content.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (germanNumericMatch) {
        result.start = `${germanNumericMatch[3]}-${germanNumericMatch[2].padStart(2, '0')}-${germanNumericMatch[1].padStart(2, '0')}`;
      }
    }
    
    // ISO format: 2025-11-12 (YYYY-MM-DD)
    if (!result.start) {
      const isoMatch = content.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        result.start = isoMatch[0];
      }
    }
    
    // English month name: November 12, 2025 or November 12 2025 (MONTH DAY, YEAR)
    if (!result.start) {
      const monthMatch = content.match(new RegExp(`${monthNames}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'));
      if (monthMatch) {
        const month = parseMonth(monthMatch[1]);
        if (month !== null) {
          result.start = `${monthMatch[3]}-${month.toString().padStart(2, '0')}-${monthMatch[2].padStart(2, '0')}`;
        }
      }
    }
    
    // Date range format: "10 - 11 June 2026" or "10-11 June 2026"
    if (!result.start) {
      const rangeMatch = content.match(new RegExp(`(\\d{1,2})\\s*[–-]\\s*(\\d{1,2})\\s+${monthNames}\\s+(\\d{4})`, 'i'));
      if (rangeMatch) {
        const month = parseMonth(rangeMatch[3]);
        if (month !== null) {
          result.start = `${rangeMatch[4]}-${month.toString().padStart(2, '0')}-${rangeMatch[1].padStart(2, '0')}`;
          result.end = `${rangeMatch[4]}-${month.toString().padStart(2, '0')}-${rangeMatch[2].padStart(2, '0')}`;
        }
      }
    }
  }
  
  return result;
}

/**
 * Parse month name to number
 */
function parseMonth(monthName: string): number | null {
  const months: Record<string, number> = {
    'january': 1, 'januar': 1,
    'february': 2, 'februar': 2,
    'march': 3, 'märz': 3,
    'april': 4,
    'may': 5, 'mai': 5,
    'june': 6, 'juni': 6,
    'july': 7, 'juli': 7,
    'august': 8,
    'september': 9,
    'october': 10, 'oktober': 10,
    'november': 11,
    'december': 12, 'dezember': 12
  };
  
  return months[monthName.toLowerCase()] || null;
}

/**
 * Normalize date to ISO format
 */
function normalizeDate(dateStr: string): string | null {
  try {
    // If already ISO, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }
  
  return null;
}

/**
 * Extract location from content
 */
function extractLocationFromContent(content: string): {
  city: string | null;
  country_code: string | null;
  venue: string | null;
} {
  const result = {
    city: null as string | null,
    country_code: null as string | null,
    venue: null as string | null
  };
  
  // Try schema.org
  const cityMatch = content.match(/"addressLocality"\s*:\s*"([^"]+)"/i) ||
                    content.match(/itemprop=["']addressLocality["'][^>]*>([^<]+)</i);
  const countryMatch = content.match(/"addressCountry"\s*:\s*"([^"]+)"/i) ||
                       content.match(/itemprop=["']addressCountry["'][^>]*>([^<]+)</i);
  const venueMatch = content.match(/"location"\s*:\s*{\s*"name"\s*:\s*"([^"]+)"/i) ||
                     content.match(/itemprop=["']location["'][^>]*>([^<]+)</i);
  
  if (cityMatch) {
    result.city = cityMatch[1].trim();
  }
  
  if (countryMatch) {
    const country = countryMatch[1].trim();
    if (/^(DE|DEU|Germany|Deutschland)$/i.test(country)) {
      result.country_code = 'DE';
    } else if (/^(AT|AUT|Austria|Österreich)$/i.test(country)) {
      result.country_code = 'AT';
    } else if (/^(CH|CHE|Switzerland|Schweiz)$/i.test(country)) {
      result.country_code = 'CH';
    }
  }
  
  if (venueMatch) {
    result.venue = venueMatch[1].trim();
  }
  
  return result;
}

