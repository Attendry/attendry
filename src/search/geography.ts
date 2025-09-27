/**
 * Geography Assignment Utilities
 * 
 * Don't invent city/country for informational pages
 */

export interface ParsedDoc {
  schemaEvent?: {
    location?: {
      address?: {
        addressCountry?: string;
        addressLocality?: string;
      };
    };
  };
}

export function assignGeography(doc: ParsedDoc): { country: string|null; city: string|null } {
  // Only set when confidently parsed from structured event metadata (schema.org Event) or explicit text with country code.
  if (doc.schemaEvent?.location?.address?.addressCountry) {
    return { 
      country: doc.schemaEvent.location.address.addressCountry, 
      city: doc.schemaEvent.location.address.addressLocality ?? null 
    };
  }
  return { country: null, city: null }; // informational pages like gdpr.eu, eur-lex
}
