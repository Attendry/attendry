/**
 * Country and Date Inference Utilities
 * 
 * This module provides utilities to infer country and extract dates
 * from web pages for legal events.
 */

import { CITY_LIST_DE, DATE_PATTERNS, GERMAN_MONTHS } from '@/config/search-legal-de';

export interface CountryDateResult {
  country: 'DE' | 'AT' | 'CH' | 'OTHER';
  dateISO?: string;
  confidence: number;
}

/**
 * Infers country and extracts date from page content
 */
export function inferCountryAndDate(
  url: string,
  content: string,
  fromISO: string,
  toISO: string,
  allowUndated: boolean = false
): CountryDateResult {
  const country = inferCountry(url, content);
  const dateResult = extractDate(content);
  
  // Check if date is within range
  let dateISO: string | undefined;
  if (dateResult.dateISO) {
    if (isDateInRange(dateResult.dateISO, fromISO, toISO)) {
      dateISO = dateResult.dateISO;
    } else if (!allowUndated) {
      // Date outside range and undated not allowed
      return {
        country,
        confidence: 0
      };
    }
  } else if (!allowUndated) {
    // No date found and undated not allowed
    return {
      country,
      confidence: 0
    };
  }

  // Calculate confidence based on country and date
  let confidence = 0.5;
  
  if (country === 'DE') {
    confidence += 0.3;
  }
  
  if (dateISO) {
    confidence += 0.2;
  }

  return {
    country,
    dateISO,
    confidence: Math.min(confidence, 1)
  };
}

/**
 * Infers country from URL and content
 */
function inferCountry(url: string, content: string): 'DE' | 'AT' | 'CH' | 'OTHER' {
  // Check URL TLD first
  if (url.includes('.de')) {
    return 'DE';
  }
  if (url.includes('.at')) {
    return 'AT';
  }
  if (url.includes('.ch')) {
    return 'CH';
  }

  // Check content for country indicators
  const contentLower = content.toLowerCase();
  
  // German indicators
  if (contentLower.includes('deutschland') || 
      contentLower.includes('germany') ||
      contentLower.includes('berlin') ||
      contentLower.includes('münchen') ||
      contentLower.includes('hamburg') ||
      contentLower.includes('köln') ||
      contentLower.includes('frankfurt')) {
    return 'DE';
  }

  // Austrian indicators
  if (contentLower.includes('österreich') || 
      contentLower.includes('austria') ||
      contentLower.includes('wien') ||
      contentLower.includes('salzburg') ||
      contentLower.includes('graz')) {
    return 'AT';
  }

  // Swiss indicators
  if (contentLower.includes('schweiz') || 
      contentLower.includes('switzerland') ||
      contentLower.includes('zürich') ||
      contentLower.includes('basel') ||
      contentLower.includes('bern')) {
    return 'CH';
  }

  // Check for German cities
  const hasGermanCity = CITY_LIST_DE.some(city => 
    contentLower.includes(city.toLowerCase())
  );

  if (hasGermanCity) {
    return 'DE';
  }

  return 'OTHER';
}

/**
 * Extracts date from content
 */
function extractDate(content: string): { dateISO?: string; confidence: number } {
  const contentLower = content.toLowerCase();
  
  // Try each date pattern
  for (const pattern of DATE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        const parsed = parseDateMatch(match);
        if (parsed) {
          return { dateISO: parsed, confidence: 0.8 };
        }
      }
    }
  }

  // Try to find date-like strings manually
  const dateLikeStrings = content.match(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}\b/g);
  if (dateLikeStrings) {
    for (const dateStr of dateLikeStrings) {
      const parsed = parseDateMatch(dateStr);
      if (parsed) {
        return { dateISO: parsed, confidence: 0.6 };
      }
    }
  }

  return { confidence: 0 };
}

/**
 * Parses a date match into ISO format
 */
function parseDateMatch(match: string): string | null {
  try {
    // Handle dd.mm.yyyy
    const ddmmyyyy = match.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Handle dd. MMMM yyyy
    const ddMMMMyyyy = match.match(/(\d{1,2})\.\s+(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/i);
    if (ddMMMMyyyy) {
      const [, day, monthName, year] = ddMMMMyyyy;
      const month = GERMAN_MONTHS[monthName as keyof typeof GERMAN_MONTHS];
      if (month) {
        return `${year}-${month}-${day.padStart(2, '0')}`;
      }
    }

    // Handle dd. MMMM yyyy (without spaces)
    const ddMMMMyyyyNoSpaces = match.match(/(\d{1,2})\.(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(\d{4})/i);
    if (ddMMMMyyyyNoSpaces) {
      const [, day, monthName, year] = ddMMMMyyyyNoSpaces;
      const month = GERMAN_MONTHS[monthName as keyof typeof GERMAN_MONTHS];
      if (month) {
        return `${year}-${month}-${day.padStart(2, '0')}`;
      }
    }

    // Handle dd–dd MMM yyyy
    const ddMMMyyyy = match.match(/(\d{1,2})–(\d{1,2})\s+(Jan|Feb|Mär|Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez)\s+(\d{4})/i);
    if (ddMMMyyyy) {
      const [, startDay, endDay, monthName, year] = ddMMMyyyy;
      const month = GERMAN_MONTHS[monthName as keyof typeof GERMAN_MONTHS];
      if (month) {
        // Use start date
        return `${year}-${month}-${startDay.padStart(2, '0')}`;
      }
    }

    // Handle ISO format
    const iso = match.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return match;
    }

    // Try to parse as Date
    const date = new Date(match);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

  } catch (error) {
    console.warn('Error parsing date match:', match, error);
  }

  return null;
}

/**
 * Checks if date is within range
 */
function isDateInRange(dateISO: string, fromISO: string, toISO: string): boolean {
  const date = new Date(dateISO);
  const from = new Date(fromISO);
  const to = new Date(toISO);
  
  return date >= from && date <= to;
}

/**
 * Normalizes German month names
 */
export function normalizeGermanDate(dateStr: string): string | null {
  const normalized = dateStr
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  
  return parseDateMatch(normalized);
}
