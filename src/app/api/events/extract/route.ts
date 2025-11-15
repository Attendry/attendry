export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { fetchWithRetry } from "@/lib/http";
import { 
  EventExtractionRequest, 
  EventExtractionResponse, 
  ErrorResponse 
} from "@/lib/types/api";
import { EventData } from "@/lib/types/core";
import { normalizeOrg } from "@/lib/utils/org-normalizer";
import { normalizeTopics } from "@/lib/utils/topic-normalizer";
import { validateExtraction, calculateConfidence, applyHallucinationGuard, EvidenceTag } from "@/lib/validation/evidence-validator";

// --- Enhanced schema with organization types
const EVENT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    starts_at: { type: ["string","null"] },
    ends_at:   { type: ["string","null"] },
    city: { type: ["string","null"] },
    country: { type: ["string","null"] },
    venue: { type: ["string","null"] },
    organizer: { type: ["string","null"] },
    topics: { type: "array", items: { type: "string" } },
    speakers: { 
      type: "array", 
      items: { 
        type: "object", 
        properties: { 
          name: { type: "string" }, 
          org: { type: "string" }, 
          title: { type: "string" },
          speech_title: { type: ["string","null"] },
          session: { type: ["string","null"] },
          bio: { type: ["string","null"] }
        }
      }
    },
    sponsors: { 
      type: "array", 
      items: { 
        type: "object", 
        properties: { 
          name: { type: "string" }, 
          level: { type: ["string","null"] },
          description: { type: ["string","null"] }
        }
      }
    },
    participating_organizations: { type: "array", items: { type: "string" } },
    partners: { type: "array", items: { type: "string" } },
    competitors: { type: "array", items: { type: "string" } },
    confidence: { type: ["number","null"] },
    evidence: { 
      type: "array", 
      items: { 
        type: "object",
        properties: {
          field: { type: "string" },
          source_url: { type: "string" },
          source_section: { type: "string" },
          snippet: { type: "string" },
          confidence: { type: "number" },
          extracted_at: { type: "string" }
        }
      }
    }
  },
  required: ["title"]
} as const;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari";

// --- Small helpers
function lc(v: unknown): string { try { return (v ?? '').toString().toLowerCase(); } catch { return ''; } }
function decodeEntities(s?: string | null) {
  if (!s) return s ?? null;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Uuml;/g, "Ü")
    .trim();
}

// Comprehensive text cleaning function
function cleanText(s?: string | null): string | null {
  if (!s) return null;
  
  let cleaned = s
    // Decode HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&euro;/g, "€")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    // Remove HTML tags
    .replace(/<[^>]*>/g, " ")
    // Clean up whitespace
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
  
  // Remove common artifacts
  cleaned = cleaned
    .replace(/^\d+\s*-\s*/, "") // Remove leading numbers with dashes
    .replace(/^[•\-\*]\s*/, "") // Remove bullet points
    .replace(/\s*[•\-\*]\s*$/, "") // Remove trailing bullet points
    .replace(/^[:\-]\s*/, "") // Remove leading colons/dashes
    .replace(/\s*[:\-]\s*$/, "") // Remove trailing colons/dashes
    .trim();
  
  return cleaned || null;
}

// Clean venue-specific text
function cleanVenueText(s?: string | null): string | null {
  if (!s) return null;
  
  let cleaned = cleanText(s);
  if (!cleaned) return null;
  
  // Remove common venue artifacts
  cleaned = cleaned
    .replace(/^venue\s*:?\s*/i, "")
    .replace(/^location\s*:?\s*/i, "")
    .replace(/^address\s*:?\s*/i, "")
    .replace(/^adresse\s*:?\s*/i, "")
    .replace(/^ort\s*:?\s*/i, "")
    .replace(/^veranstaltungsort\s*:?\s*/i, "")
    // Remove long descriptive text that's not venue name
    .replace(/\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+.*$/, "")
    .replace(/\s+[A-Z][a-z]+\s+[A-Z][a-z]+.*$/, "")
    // Remove common non-venue patterns
    .replace(/^(zur|für|von|der|die|das|den|dem|des|ein|eine|eines|einer|einen|einem)\s+/i, "")
    .replace(/\s+(zur|für|von|der|die|das|den|dem|des|ein|eine|eines|einer|einen|einem)\s+.*$/i, "")
    .replace(/\s+(Erlangung|Aufrechterhaltung|Sachkunde|Mitarbeiter|Studenten|Teilnehmer).*$/i, "")
    .replace(/\s+(up to|bis zu|maximal|maximum).*$/i, "")
    .trim();
  
  // If it's too long, it's probably not a venue name
  if (cleaned.length > 80) {
    return null;
  }
  
  // If it contains job titles or non-venue words, it's probably not a venue
  if (/\b(Vorständ|Mitarbeiter|Studenten|Teilnehmer|Personen|up to|bis zu)\b/i.test(cleaned)) {
    return null;
  }
  
  return cleaned || null;
}

// PHASE 1 OPTIMIZATION: Enhanced city validation with comprehensive whitelist/blacklist
// Valid city names (expanded whitelist for DE, FR, NL, UK, etc.)
const VALID_CITIES = new Set([
  // German cities
  'berlin', 'hamburg', 'münchen', 'munich', 'köln', 'cologne', 'frankfurt', 'stuttgart',
  'düsseldorf', 'dortmund', 'essen', 'leipzig', 'bremen', 'dresden', 'hannover',
  'nürnberg', 'nuremberg', 'duisburg', 'bochum', 'wuppertal', 'bonn', 'bielefeld',
  'mannheim', 'karlsruhe', 'münster', 'wiesbaden', 'augsburg', 'aachen', 'freiburg',
  'krefeld', 'lübeck', 'oberhausen', 'erfurt', 'mainz', 'rostock', 'kiel', 'halle',
  'magdeburg', 'braunschweig', 'chemnitz', 'mönchengladbach', 'gelsenkirchen',
  // French cities
  'paris', 'lyon', 'marseille', 'toulouse', 'nice', 'nantes', 'strasbourg', 'montpellier',
  'bordeaux', 'lille', 'rennes', 'reims', 'saint-étienne', 'toulon', 'grenoble',
  // Dutch cities
  'amsterdam', 'rotterdam', 'the hague', 'den haag', 'utrecht', 'eindhoven', 'groningen',
  'tilburg', 'almere', 'breda', 'nijmegen', 'enschede', 'haarlem', 'arnhem',
  // UK cities
  'london', 'birmingham', 'manchester', 'glasgow', 'liverpool', 'leeds', 'sheffield',
  'edinburgh', 'bristol', 'cardiff', 'belfast', 'newcastle', 'nottingham', 'leicester',
  // Other European cities
  'vienna', 'wien', 'zurich', 'brussels', 'brussel', 'copenhagen', 'stockholm', 'oslo',
  'helsinki', 'dublin', 'madrid', 'barcelona', 'rome', 'milan', 'warsaw', 'prague',
  // Common misspellings/variations
  'muenchen', 'koeln', 'duesseldorf', 'nuernberg', 'moenchengladbach'
].map(c => c.toLowerCase()));

// Invalid terms that should never be treated as cities (expanded blacklist)
const INVALID_CITY_TERMS = new Set([
  // German topic words
  'praxisnah', 'whistleblowing', 'politik', 'forschung', 'innovation', 'entwicklung',
  // Business/legal terms
  'compliance', 'legal', 'investigation', 'ediscovery', 'audit', 'risk', 'governance',
  'regulation', 'policy', 'framework', 'standard', 'procedure', 'process',
  'management', 'strategy', 'implementation', 'monitoring', 'reporting',
  'training', 'education', 'certification', 'accreditation', 'assessment',
  // Common false positives
  'online', 'virtual', 'hybrid', 'webinar', 'conference', 'summit', 'workshop',
  'seminar', 'event', 'meeting', 'session', 'track', 'agenda', 'program'
].map(t => t.toLowerCase()));

// Clean city-specific text
function cleanCityText(s?: string | null): string | null {
  if (!s) return null;
  
  let cleaned = cleanText(s);
  if (!cleaned) return null;
  
  // Remove common city artifacts
  cleaned = cleaned
    .replace(/^city\s*:?\s*/i, "")
    .replace(/^stadt\s*:?\s*/i, "")
    .replace(/^ort\s*:?\s*/i, "")
    .replace(/^location\s*:?\s*/i, "")
    // Remove job titles and non-city words
    .replace(/\b(Vorständ|Mitarbeiter|Studenten|Teilnehmer|Personen|up to|bis zu|maximal|maximum)\b.*$/i, "")
    .replace(/\b(Compliance|Officer|Manager|Director|Lead|Head|Chief)\b.*$/i, "")
    .trim();
  
  // If it's too long, it's probably not a city name
  if (cleaned.length > 50) {
    return null;
  }
  
  const cleanedLower = lc(cleaned);
  
  // PHASE 1: Check blacklist first (strict rejection)
  if (INVALID_CITY_TERMS.has(cleanedLower) || 
      Array.from(INVALID_CITY_TERMS).some(term => cleanedLower.includes(term))) {
    return null;
  }
  
  // If it contains job titles or non-city words, it's probably not a city
  if (/\b(Vorständ|Mitarbeiter|Studenten|Teilnehmer|Personen|up to|bis zu|Compliance|Officer)\b/i.test(cleaned)) {
    return null;
  }
  
  // PHASE 1: Check whitelist (known valid cities)
  if (VALID_CITIES.has(cleanedLower)) {
    return cleaned; // Return original case for known cities
  }
  
  // If it's not a known city, be more strict - only allow if it looks like a proper city name
  // Must be alphabetic (with umlauts), 3-50 chars, no numbers, no special business terms
  if (!/^[A-Za-zäöüÄÖÜß\s-]+$/.test(cleaned) || cleaned.length < 3) {
    return null;
  }
  
  // Additional check: reject if it contains common business/event terms
  const businessTerms = /\b(conference|summit|workshop|seminar|event|meeting|session|track|agenda|program|online|virtual|hybrid)\b/i;
  if (businessTerms.test(cleaned)) {
    return null;
  }
  
  return cleaned || null;
}

const COUNTRY_BY_CODE: Record<string,string> = {
  DE:"Germany", FR:"France", NL:"Netherlands", IT:"Italy", ES:"Spain", PL:"Poland",
  SE:"Sweden", BE:"Belgium", CH:"Switzerland", AT:"Austria", DK:"Denmark",
  FI:"Finland", NO:"Norway", PT:"Portugal", CZ:"Czechia", IE:"Ireland", UK:"United Kingdom", GB:"United Kingdom"
};

function normalizeCountry(val?: string | null): string | null {
  if (!val) return null;
  const v = val.trim();
  const up = v.toUpperCase();
  if (COUNTRY_BY_CODE[up]) return COUNTRY_BY_CODE[up];
  // common full names already ok
  return v;
}

function normalizeIsoDate(val?: string | null) {
  if (!val) return null;
  // If it's a datetime (e.g., 2025-09-18T12:30:00+02:00), trim to date
  const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : val;
}
const EU_TLD_COUNTRY: Record<string,string> = {
  de:"Germany", fr:"France", nl:"Netherlands", it:"Italy", es:"Spain", pl:"Poland",
  se:"Sweden", be:"Belgium", ch:"Switzerland", at:"Austria", dk:"Denmark",
  fi:"Finland", no:"Norway", pt:"Portugal", cz:"Czechia", ie:"Ireland", uk:"United Kingdom", gb:"United Kingdom"
};
function guessCountryFromHost(u: string): string | null {
  try { const host = lc(new URL(u).hostname); const tld = host.split(".").pop()!; return EU_TLD_COUNTRY[tld] || null; } catch { return null; }
}
// Enhanced event quality scoring
function calculateEventConfidence(event: any): number {
  let confidence = 0.3; // base confidence
  
  // Title quality
  const title = event.title || "";
  if (title.length >= 10) confidence += 0.1;
  if (title.length >= 20) confidence += 0.1;
  if (!(lc(title).includes('untitled')) && !(lc(title).includes('event'))) confidence += 0.1;
  
  // Penalize generic titles
  if (lc(title) === 'event' || lc(title) === 'untitled event') {
    confidence -= 0.2;
  }
  
  // Date presence and validity
  if (event.starts_at) {
    confidence += 0.2;
    // Check if date is reasonable (not too far in past/future)
    const startDate = new Date(event.starts_at);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    
    if (startDate >= oneYearAgo && startDate <= twoYearsFromNow) {
      confidence += 0.1;
    }
  }
  
  // Location information
  if (event.city) confidence += 0.1;
  if (event.country) confidence += 0.1;
  if (event.venue) confidence += 0.1;
  
  // Organizer information
  if (event.organizer) confidence += 0.1;
  
  // Topics/themes
  if (event.topics && event.topics.length > 0) confidence += 0.1;
  
  // Speakers
  if (event.speakers && event.speakers.length > 0) confidence += 0.1;
  
  // Penalize obviously invalid events
  if (lc(title).includes('404') || 
      lc(title).includes('not found') ||
      lc(title).includes('error') ||
      title.length < 3) {
    confidence = 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

function shape(url: string, p: Partial<Record<string, any>>) {
  // Try to extract a better title from the URL if no title is provided
  let title = decodeEntities(p.title);
  if (!title || title.trim().length === 0) {
    // Try to extract title from URL path
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        // Use the last meaningful part of the URL as title
        const lastPart = pathParts[pathParts.length - 1];
        title = lastPart.replace(/[-_]/g, ' ').replace(/\.[^.]*$/, ''); // Remove file extensions
        title = title.charAt(0).toUpperCase() + title.slice(1);
      }
    } catch {
      // If URL parsing fails, use hostname
      try {
        const urlObj = new URL(url);
        title = urlObj.hostname.replace('www.', '');
      } catch {
        title = "Event";
      }
    }
  }
  
  const event = {
    source_url: url,
    title: cleanText(title) || "Event",
    starts_at: normalizeIsoDate(p.starts_at ?? null),
    ends_at: normalizeIsoDate(p.ends_at ?? null),
    city: cleanCityText(p.city) ?? null,
    country: normalizeCountry(p.country ?? null),
    venue: cleanVenueText(p.venue) ?? null,
    organizer: cleanText(p.organizer) ?? null,
    topics: normalizeTopics(Array.isArray(p.topics) ? p.topics.map(cleanText).filter(Boolean) : []), // PHASE 2: Normalize topics to taxonomy
    speakers: Array.isArray(p.speakers) ? p.speakers.map(speaker => ({
      name: cleanText(speaker.name) || "",
      org: normalizeOrg(cleanText(speaker.org)) || "", // PHASE 2: Normalize org names
      title: cleanText(speaker.title) || "",
      speech_title: cleanText(speaker.speech_title) || null,
      session: cleanText(speaker.session) || null,
      bio: cleanText(speaker.bio) || null
    })).filter(s => s.name) : [],
    sponsors: Array.isArray(p.sponsors) ? p.sponsors.map(sponsor => {
      if (typeof sponsor === 'string') {
        return { name: normalizeOrg(cleanText(sponsor)) || "", level: null, description: null }; // PHASE 2: Normalize sponsor names
      }
      return {
        name: normalizeOrg(cleanText(sponsor.name)) || "", // PHASE 2: Normalize sponsor names
        level: cleanText(sponsor.level) || null,
        description: cleanText(sponsor.description) || null
      };
    }).filter(s => s.name) : [],
    participating_organizations: Array.isArray(p.participating_organizations) ? p.participating_organizations.map(org => normalizeOrg(cleanText(org))).filter(Boolean) : [], // PHASE 2: Normalize org names
    partners: Array.isArray(p.partners) ? p.partners.map(org => normalizeOrg(cleanText(org))).filter(Boolean) : [], // PHASE 2: Normalize org names
    competitors: Array.isArray(p.competitors) ? p.competitors.map(org => normalizeOrg(cleanText(org))).filter(Boolean) : [], // PHASE 2: Normalize org names
    confidence: typeof p.confidence === "number" ? p.confidence : null,
  };
  
  // PHASE 2: Validate evidence and apply hallucination guard
  const evidence = Array.isArray(p.evidence) ? p.evidence as EvidenceTag[] : [];
  const validation = validateExtraction({ ...event, evidence });
  
  // Apply hallucination guard (auto-null fields without evidence)
  const guardedEvent = applyHallucinationGuard({ ...event, evidence }, evidence);
  
  // Calculate confidence based on evidence quality
  const evidenceBasedConfidence = calculateConfidence({ ...guardedEvent, evidence });
  
  // Use evidence-based confidence if available, otherwise fall back to original
  guardedEvent.confidence = evidenceBasedConfidence || calculateEventConfidence(guardedEvent);
  
  // Log validation warnings if any
  if (validation.warnings.length > 0) {
    console.warn('[extract] Evidence validation warnings:', validation.warnings);
  }
  
  return guardedEvent;
}
function htmlToText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi," ")
             .replace(/<style[\s\S]*?<\/style>/gi," ")
             .replace(/<[^>]+>/g," ")
             .replace(/&(?:nbsp|amp|quot|#39|laquo|raquo);/g," ")
             .replace(/\s+/g," ")
             .trim()
             .slice(0, 50000);
}

// --- JSON-LD Event
function parseJsonLd(html: string) {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const m = b.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (!m) continue;
    try {
      const json = JSON.parse(m[1]);
      const arr = Array.isArray(json) ? json : [json];
      for (const node of arr) {
        const t = lc((node["@type"] || node.type || "").toString());
        if (!t.includes("event")) continue;
        const ev = node, loc = ev.location || {}, addr = loc.address || {};
        const country = addr.addressCountry || addr.country || null;
        return {
          title: ev.name || null,
          starts_at: ev.startDate || null,
          ends_at: ev.endDate || null,
          city: addr.addressLocality || null,
          country,
          venue: loc.name || addr.streetAddress || null,
          organizer: ev.organizer?.name || (typeof ev.organizer === "string" ? ev.organizer : null),
        };
      }
    } catch { /* skip bad JSON-LD */ }
  }
  return null;
}

// --- Regex fallback (EU/German-ish)
const MONTHS: Record<string,string> = {
  jan:"01", januar:"01", january:"01",
  feb:"02", februar:"02", february:"02",
  märz:"03", maerz:"03", mar:"03", march:"03",
  apr:"04", april:"04",
  mai:"05", may:"05",
  jun:"06", juni:"06", june:"06",
  jul:"07", juli:"07", july:"07",
  aug:"08", august:"08",
  sep:"09", sept:"09", september:"09",
  okt:"10", oktober:"10", october:"10",
  nov:"11", november:"11",
  dez:"12", dezember:"12", dec:"12", december:"12",
};
const DE_CITIES = ["Berlin","München","Munich","Hamburg","Köln","Cologne","Frankfurt","Stuttgart","Düsseldorf","Leipzig","Bremen","Dresden","Hannover","Nürnberg","Nuremberg","Heidelberg","Freiburg","Aachen","Bonn","Münster","Mainz","Wiesbaden"];
const CITY_RE = new RegExp("\\b(" + DE_CITIES.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b","i");
const pad2 = (n: string | number) => String(n).padStart(2,"0");
function parseDates(text: string) {
  // PHASE 1 OPTIMIZATION: Enhanced date parsing for German/European formats
  const germanMonths = {
    'januar': '01', 'februar': '02', 'märz': '03', 'april': '04', 'mai': '05', 'juni': '06',
    'juli': '07', 'august': '08', 'september': '09', 'oktober': '10', 'november': '11', 'dezember': '12'
  };
  
  // Pattern: 25. September 2025 or 25. September
  let m = text.match(/\b(\d{1,2})\.\s*([a-zA-ZäöüÄÖÜ]+)\s+(\d{4})\b/i);
  if (m) {
    const day = pad2(m[1]);
    const monthName = lc(m[2]);
    const year = m[3];
    const month = germanMonths[monthName as keyof typeof germanMonths];
    if (month) {
      return { starts_at: `${year}-${month}-${day}`, ends_at: null };
    }
  }
  
  // Pattern: 25. September (current year) - but only if it's in the future
  m = text.match(/\b(\d{1,2})\.\s*([a-zA-ZäöüÄÖÜ]+)\b/i);
  if (m) {
    const day = pad2(m[1]);
    const monthName = lc(m[2]);
    const month = germanMonths[monthName as keyof typeof germanMonths];
    if (month) {
      const currentYear = new Date().getFullYear();
      const currentDate = new Date();
      const parsedDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
      
      // Only use current year if the date is in the future
      // If the date is in the past, it's likely from a past event - don't default to current year
      if (parsedDate >= currentDate) {
        return { starts_at: `${currentYear}-${month}-${day}`, ends_at: null };
      }
      // If date is in the past, try next year (for recurring events)
      const nextYear = currentYear + 1;
      const nextYearDate = new Date(nextYear, parseInt(month) - 1, parseInt(day));
      if (nextYearDate >= currentDate) {
        return { starts_at: `${nextYear}-${month}-${day}`, ends_at: null };
      }
      // Otherwise, don't guess - return null
      return { starts_at: null, ends_at: null };
    }
  }
  
  // dd.mm.yyyy (German format: 25.09.2025)
  m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (m) {
    const d = pad2(m[1]), mo = pad2(m[2]), y = m[3].length === 2 ? "20"+m[3] : m[3];
    return { starts_at: `${y}-${mo}-${d}`, ends_at: null };
  }
  
  // dd/mm/yyyy (European format: 25/09/2025)
  m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m) {
    const d = pad2(m[1]), mo = pad2(m[2]), y = m[3].length === 2 ? "20"+m[3] : m[3];
    // Validate month (1-12)
    if (parseInt(mo) >= 1 && parseInt(mo) <= 12) {
      return { starts_at: `${y}-${mo}-${d}`, ends_at: null };
    }
  }
  
  // dd-mm-yyyy (European format: 25-09-2025)
  m = text.match(/\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/);
  if (m) {
    const d = pad2(m[1]), mo = pad2(m[2]), y = m[3].length === 2 ? "20"+m[3] : m[3];
    // Validate month (1-12)
    if (parseInt(mo) >= 1 && parseInt(mo) <= 12) {
      return { starts_at: `${y}-${mo}-${d}`, ends_at: null };
    }
  }
  
  // dd–dd.mm.yyyy  OR  dd- dd.mm.yyyy (date ranges)
  m = text.match(/\b(\d{1,2})\s*[–-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (m) {
    const d1 = pad2(m[1]), d2 = pad2(m[2]), mo = pad2(m[3]), y = m[4];
    return { starts_at: `${y}-${mo}-${d1}`, ends_at: `${y}-${mo}-${d2}` };
  }
  
  // dd./dd.mm.yyyy  (German sites often write 18./19.09.2025)
  m = text.match(/\b(\d{1,2})\.\s*\/\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (m) {
    const d1 = pad2(m[1]), d2 = pad2(m[2]), mo = pad2(m[3]), y = m[4];
    return { starts_at: `${y}-${mo}-${d1}`, ends_at: `${y}-${mo}-${d2}` };
  }
  
  // dd. bis dd. Month yyyy
  m = text.match(/\b(\d{1,2})\.\s*bis\s*(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß\.]+)\s+(\d{4})\b/i);
  if (m) {
    const d1 = pad2(m[1]), d2 = pad2(m[2]);
    const mon = lc(m[3]).replace(/\./g,""); const mm = MONTHS[mon];
    if (mm) return { starts_at: `${m[4]}-${mm}-${d1}`, ends_at: `${m[4]}-${mm}-${d2}` };
  }
  
  // dd Month yyyy  (de/en)  e.g., 12 März 2026 / 12 Sep 2025
  m = text.match(/\b(\d{1,2})\s+([A-Za-zÄÖÜäöüß\.]+)\s+(\d{4})\b/);
  if (m) {
    const d = pad2(m[1]);
    const mon = lc(m[2]).replace(/\./g,"");
    const mm = MONTHS[mon];
    if (mm) return { starts_at: `${m[3]}-${mm}-${d}`, ends_at: null };
  }
  
  // dd–dd Month yyyy
  m = text.match(/\b(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-zÄÖÜäöüß\.]+)\s+(\d{4})\b/);
  if (m) {
    const d1 = pad2(m[1]), d2 = pad2(m[2]);
    const mon = lc(m[3]).replace(/\./g,"");
    const mm = MONTHS[mon];
    if (mm) return { starts_at: `${m[4]}-${mm}-${d1}`, ends_at: `${m[4]}-${mm}-${d2}` };
  }
  
  // English format: September 25, 2025 or Sep 25, 2025
  m = text.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m) {
    const mon = lc(m[1]);
    const mm = MONTHS[mon];
    if (mm) {
      const d = pad2(m[2]);
      return { starts_at: `${m[3]}-${mm}-${d}`, ends_at: null };
    }
  }
  
  // English format: 25 September 2025
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/i);
  if (m) {
    const mon = lc(m[2]);
    const mm = MONTHS[mon];
    if (mm) {
      const d = pad2(m[1]);
      return { starts_at: `${m[3]}-${mm}-${d}`, ends_at: null };
    }
  }
  
  return { starts_at: null, ends_at: null };
}

// --- Firecrawl v2 job polling
async function pollExtract(id: string, key: string) {
  const base = "https://api.firecrawl.dev/v2/extract";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const start = Date.now(), timeout = 15000, step = 800;
  while (Date.now() - start < timeout) {
    const r = await fetchWithRetry(`${base}/${id}`, { headers, cache: "no-store", timeoutMs: 10000, retries: 2 });
    const j = await r.json().catch(() => ({}));
    if (j?.status === "completed") return j?.data ?? null;
    if (j?.status === "failed" || j?.status === "cancelled") break;
    await new Promise(res => setTimeout(res, step));
  }
  return null;
}
function pickData(d: any) {
  if (!d) return null;
  if (Array.isArray(d)) return d[0] ?? null;
  if (d?.results?.length) return d.results[0].data ?? d.results[0];
  return d;
}

/**
 * FIRECRAWL-V2: Process extraction response to extract images and data attributes
 * Filters out logos/icons and keeps only relevant event images
 */
function processExtractionResponse(extractedData: any, fullResponse: any): any {
  const processed = { ...extractedData };
  
  // Process images from response
  if (fullResponse?.data?.images || fullResponse?.images) {
    const images = fullResponse?.data?.images || fullResponse?.images || [];
    // Filter out logos, icons, and small images, keep only event-relevant images
    const eventImages = images
      .filter((img: any) => {
        const url = img.url || img.src || '';
        const isLogo = url.toLowerCase().includes('logo') || 
                      url.toLowerCase().includes('icon') ||
                      url.toLowerCase().includes('favicon');
        const isSmall = img.width && img.width < 200 || img.height && img.height < 200;
        return !isLogo && !isSmall && url.startsWith('http');
      })
      .slice(0, 5) // Keep top 5 event images
      .map((img: any) => ({
        url: img.url || img.src,
        alt: img.alt || null,
        width: img.width || null,
        height: img.height || null
      }));
    
    if (eventImages.length > 0) {
      processed.metadata = {
        ...(processed.metadata || {}),
        images: eventImages
      };
    }
  }
  
  // Process data attributes from response
  if (fullResponse?.data?.dataAttributes || fullResponse?.dataAttributes) {
    const dataAttributes = fullResponse?.data?.dataAttributes || fullResponse?.dataAttributes || {};
    
    // Extract event-related data attributes
    const eventDataAttributes: Record<string, any> = {};
    const eventKeys = ['event-date', 'event-location', 'event-venue', 'event-title', 'event-start', 'event-end'];
    
    for (const key of eventKeys) {
      if (dataAttributes[key]) {
        eventDataAttributes[key] = dataAttributes[key];
      }
    }
    
    // Also check for common data attribute patterns
    Object.keys(dataAttributes).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('event') || lowerKey.includes('date') || lowerKey.includes('location')) {
        eventDataAttributes[key] = dataAttributes[key];
      }
    });
    
    if (Object.keys(eventDataAttributes).length > 0) {
      processed.metadata = {
        ...(processed.metadata || {}),
        dataAttributes: eventDataAttributes
      };
    }
  }
  
  // Process PDF metadata if available
  if (fullResponse?.data?.pdfMetadata || fullResponse?.pdfMetadata) {
    const pdfMetadata = fullResponse?.data?.pdfMetadata || fullResponse?.pdfMetadata;
    if (pdfMetadata?.title && !processed.title) {
      processed.title = pdfMetadata.title;
    }
    if (pdfMetadata?.metadata) {
      processed.metadata = {
        ...(processed.metadata || {}),
        pdfMetadata: pdfMetadata.metadata
      };
    }
  }
  
  return processed;
}

function normalizeUrl(u: string) {
  try {
    const url = new URL(u);
    url.hash = "";
    url.search = "";
    let path = url.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    return `${url.hostname.toLowerCase()}${path}`;
  } catch { return u; }
}

// Load industry-specific extraction context
async function getExtractionContext(origin?: string) {
  try {
    const base = origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:4000';
    const res = await fetch(new URL('/api/config/search', base).toString());
    const data = await res.json();
    return {
      industry: data.config?.industry || 'general',
      industryTerms: data.config?.industryTerms || [],
      baseQuery: data.config?.baseQuery || ''
    };
  } catch (error) {
    return {
      industry: 'general',
      industryTerms: [],
      baseQuery: ''
    };
  }
}

// Enhanced date parsing with more patterns
function parseEnhancedDates(text: string) {
  const dates = parseDates(text);
  if (dates.starts_at && dates.ends_at) return dates;

  // Additional patterns for better coverage
  const patterns = [
    // ISO dates: 2024-12-15 to 2024-12-17
    /(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i,
    // European format: 15.12.2024 - 17.12.2024
    /(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/i,
    // Month ranges: December 15-17, 2024
    /([A-Za-z]+)\s+(\d{1,2})[-–](\d{1,2}),?\s+(\d{4})/i,
    // Full date ranges: December 15, 2024 - December 17, 2024
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Parse and normalize the dates
      try {
        const startDate = new Date(match[1] || match[2] || match[4]);
        const endDate = new Date(match[2] || match[3] || match[6]);
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          // Validate that dates are reasonable (not too far in past/future)
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          const twoYearsFromNow = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
          
          if (startDate >= oneYearAgo && startDate <= twoYearsFromNow && 
              endDate >= oneYearAgo && endDate <= twoYearsFromNow) {
            return {
              starts_at: startDate.toISOString().split('T')[0],
              ends_at: endDate.toISOString().split('T')[0]
            };
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  return dates;
}

// Enhanced venue and location parsing
function parseEnhancedLocation(text: string, hostCountry: string | null) {
  const locationPatterns = [
    // Venue, City format
    /at\s+([^,]+),\s*([^,]+)/i,
    // City, Country format
    /in\s+([^,]+),\s*([^,]+)/i,
    // Venue in City format
    /([^,]+)\s+in\s+([^,]+)/i
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      let venue = match[1]?.trim() || null;
      let city = match[2]?.trim() || null;
      
      // Clean up venue and city - remove common noise words
      if (venue) {
        venue = venue.replace(/\b(venue|location|place|address|at|in|on|the)\b/gi, '').trim();
        venue = venue.replace(/^[,\s]+|[,\s]+$/g, ''); // Remove leading/trailing commas and spaces
      }
      
      if (city) {
        city = city.replace(/\b(venue|location|place|address|at|in|on|the|germany|deutschland|de)\b/gi, '').trim();
        city = city.replace(/^[,\s]+|[,\s]+$/g, ''); // Remove leading/trailing commas and spaces
        
        // If city is too long or contains random text, try to extract just the city name
        if (city.length > 50 || city.includes('random') || city.includes('text')) {
          // Try to find a known German city in the text
          const germanCityMatch = text.match(/\b(Berlin|München|Munich|Hamburg|Köln|Cologne|Frankfurt|Stuttgart|Düsseldorf|Leipzig|Bremen|Dresden|Hannover|Nürnberg|Nuremberg|Heidelberg|Freiburg|Aachen|Bonn|Münster|Mainz|Wiesbaden)\b/i);
          if (germanCityMatch) {
            city = germanCityMatch[1];
          } else {
            city = null; // Don't use random text as city
          }
        }
        
        // Additional validation: reject common non-city terms
        const invalidCityTerms = [
          'praxisnah', 'whistleblowing', 'politik', 'forschung', 'compliance', 
          'legal', 'investigation', 'ediscovery', 'audit', 'risk', 'governance',
          'regulation', 'policy', 'framework', 'standard', 'procedure', 'process',
          'management', 'strategy', 'implementation', 'monitoring', 'reporting',
          'training', 'education', 'certification', 'accreditation', 'assessment'
        ];
        
        if (city && invalidCityTerms.some(term => lc(city).includes(lc(term)))) {
          city = null;
        }
      }
      
      return {
        venue: venue || null,
        city: city || null,
        country: hostCountry
      };
    }
  }

  return { venue: null, city: null, country: hostCountry };
}

// --- Extract one URL (NEVER returns undefined)
/**
 * PERF-2.2.5: Batch extraction using Firecrawl v2 batch API
 * Extracts multiple URLs in a single API call to reduce overhead
 */
async function extractBatch(urls: string[], key: string, locale: string, trace: any[], origin?: string, crawl?: any): Promise<Array<{ url: string; data: any }>> {
  const hostCountry = guessCountryFromHost(urls[0] || '');
  const context = await getExtractionContext(origin);
  
  const industryContext = context.industryTerms.length > 0 
    ? ` Focus on ${context.industry} industry events. Key terms: ${context.industryTerms.slice(0, 5).join(', ')}.`
    : '';
  
  const enhancedPrompt = `You are an expert event data extractor. Extract ONLY information explicitly stated on the page or in linked PDF documents.

CRITICAL RULES:
1. If information is NOT found, use null (not empty string, not "Unknown", not guesses)
2. For each extracted field, cite the source section and snippet in the evidence array
3. Normalize dates to YYYY-MM-DD format (handle German: 25.09.2025, European: 25/09/2025, English: September 25, 2025)
4. Normalize topics to the provided taxonomy (see below)
5. Extract speakers ONLY if explicitly listed as speakers/presenters/keynote speakers
   IMPORTANT: Speakers are often listed in PDF documents (programs, brochures, speaker lists) linked from the main page. 
   Extract ALL speakers from PDFs if available - they typically contain the most complete speaker information.
6. Extract cities ONLY if they are actual city names (not topics like "Praxisnah" or "Whistleblowing")

Extract event details for each URL provided, including content from linked PDF documents. Return structured JSON matching the schema exactly. Include evidence array for all extracted fields.

Locale: ${locale || hostCountry || "DE"}${industryContext}`;

  try {
    // PERF-1.4.1: Check rate limit before making Firecrawl extraction API call
    // PERF-1.4.3: Automatically record response time for adaptive rate limiting
    let kicked: any;
    try {
      const { withRateLimit } = await import('@/lib/services/rate-limit-service');
      kicked = await withRateLimit('firecrawl', async () => {
        return await fetchWithRetry("https://api.firecrawl.dev/v2/extract", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        urls, // PERF-2.2.5: Multiple URLs in single request
        schema: EVENT_SCHEMA,
        prompt: enhancedPrompt,
        showSources: false,
        scrapeOptions: {
          onlyMainContent: true, 
          formats: ["markdown", "html", "images"], // FIRECRAWL-V2: Added images format for event image extraction
          parsers: ["pdf"], 
          waitFor: 1200,
          location: { 
            country: (locale || hostCountry || "DE").toUpperCase(), 
            languages: ["de-DE","en-GB","fr-FR","it-IT","es-ES","nl-NL","pt-PT","pl-PL"] 
          },
          blockAds: true,
          removeBase64Images: true,
          // FIRECRAWL-V2: Extract data attributes for structured data from HTML
          extractDataAttributes: true,
          // FIRECRAWL-V2: Enhanced PDF parsing with title and metadata extraction
          pdfOptions: {
            extractTitle: true,
            extractMetadata: true
          },
          crawlerOptions: {
            maxDepth: Math.min(3, (crawl?.depth ?? 3)),
            maxPagesToCrawl: 12,
            allowSubdomains: true,
            // FIRECRAWL-V2: Natural language crawling - replaces regex patterns with AI-powered page discovery
            // This is language-agnostic and automatically finds relevant pages in any language
            prompt: "Crawl pages related to event details, speakers, presenters, agenda, program, schedule, registration, tickets, and venue information. Focus on pages that contain event information, speaker bios, session details, and registration forms."
          }
        },
        ignoreInvalidURLs: true
      })
      }).then(r => r.json());
      });
    } catch (rateLimitError) {
      console.warn('[extractBatch] Rate limit check failed, continuing without rate limiting:', rateLimitError);
      // Fallback: make call without rate limiting
      kicked = await fetchWithRetry("https://api.firecrawl.dev/v2/extract", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          urls, // PERF-2.2.5: Multiple URLs in single request
          schema: EVENT_SCHEMA,
          prompt: enhancedPrompt,
          showSources: false,
          scrapeOptions: {
            onlyMainContent: true, 
            formats: ["markdown", "html", "images"], // FIRECRAWL-V2: Added images format
            parsers: ["pdf"], 
            waitFor: 1200,
            location: { 
              country: (locale || hostCountry || "DE").toUpperCase(), 
              languages: ["de-DE","en-GB","fr-FR","it-IT","es-ES","nl-NL","pt-PT","pl-PL"] 
            },
            blockAds: true,
            removeBase64Images: true,
            // FIRECRAWL-V2: Extract data attributes for structured data from HTML
            extractDataAttributes: true,
            // FIRECRAWL-V2: Enhanced PDF parsing with title and metadata extraction
            pdfOptions: {
              extractTitle: true,
              extractMetadata: true
            },
            crawlerOptions: {
              maxDepth: Math.min(3, (crawl?.depth ?? 3)),
              maxPagesToCrawl: 12,
              allowSubdomains: true,
              // FIRECRAWL-V2: Natural language crawling - replaces regex patterns with AI-powered page discovery
              // This is language-agnostic and automatically finds relevant pages in any language
              prompt: "Crawl pages related to event details, speakers, presenters, agenda, program, schedule, registration, tickets, and venue information. Focus on pages that contain event information, speaker bios, session details, and registration forms."
            }
          },
          ignoreInvalidURLs: true
        })
      }).then(r => r.json());
    }

    if (!kicked?.id) {
      console.warn('[extractBatch] No job ID returned, falling back to individual extraction');
      return [];
    }

    const data = await pollExtract(kicked.id, key);
    
    // PERF-2.2.5: Handle batch response format
    const results: Array<{ url: string; data: any }> = [];
    
    if (data?.results && Array.isArray(data.results)) {
      // Batch format: results array with url and data
      for (const result of data.results) {
        if (result?.url && result?.data) {
          // FIRECRAWL-V2: Process images and data attributes for each result
          const processedData = processExtractionResponse(result.data, result);
          results.push({ url: result.url, data: processedData });
        }
      }
    } else if (data?.data) {
      // Single result format (fallback)
      // FIRECRAWL-V2: Process images and data attributes
      const processedData = processExtractionResponse(data.data, data);
      results.push({ url: urls[0], data: processedData });
    }
    
    trace.push({ step: "batch_extract", urls_count: urls.length, results_count: results.length });
    return results;
  } catch (error) {
    console.warn('[extractBatch] Batch extraction failed, will fall back to individual:', error);
    trace.push({ step: "batch_extract", error: error instanceof Error ? error.message : 'unknown' });
    return [];
  }
}

async function extractOne(url: string, key: string, locale: string, trace: any[], origin?: string, crawl?: any) {
  const hostCountry = guessCountryFromHost(url);
  const context = await getExtractionContext(origin);

  // Durable cache lookup (best-effort)
  try {
    const supabase = await supabaseServer();
    const norm = normalizeUrl(url);
    const { data } = await supabase
      .from("url_extractions")
      .select("payload")
      .eq("url_normalized", norm)
      .maybeSingle();
    if (data && data.payload) {
      trace.push({ url, step: "cache", hit: true });
      console.log(JSON.stringify({ at: "extract", cache: "hit", url: norm }));
      return data.payload;
    }
    console.log(JSON.stringify({ at: "extract", cache: "miss", url: norm }));
  } catch {}

  // Fetch HTML (many sites block default UA)
  let html = "";
  try {
    // main extraction flow wrapped to avoid bubbling unexpected errors
    try {
    const res = await fetchWithRetry(url, { headers: { "User-Agent": UA }, cache: "no-store", redirect: "follow", timeoutMs: 8000, retries: 2 });
    if (res.ok) html = await res.text();
    } catch {}

  // 1) JSON-LD
  if (html) {
    const ld = parseJsonLd(html);
    if (ld) {
      const ev = shape(url, {
        title: ld.title,
        starts_at: ld.starts_at || (ld as any).startDate || null,
        ends_at: ld.ends_at || (ld as any).endDate || null,
        city: ld.city || null,
        country: ld.country || hostCountry || null,
        venue: ld.venue || null,
        organizer: ld.organizer || null,
      });
      const rich = ev.starts_at || ev.city || ev.country;
      if (rich) { trace.push({ url, step: "jsonld", rich: true }); return ev; }
      trace.push({ url, step: "jsonld", rich: false });
    }
  }

  // 2) Enhanced Firecrawl v2 with industry context
  try {
    const industryContext = context.industryTerms.length > 0 
      ? ` Focus on ${context.industry} industry events. Key terms: ${context.industryTerms.slice(0, 5).join(', ')}.`
      : '';
    // PHASE 1 OPTIMIZATION: Enhanced prompt with evidence tagging requirements
    const enhancedPrompt = `You are an expert event data extractor. Extract ONLY information explicitly stated on the page.

CRITICAL RULES:
1. If information is NOT found, use null (not empty string, not "Unknown", not guesses)
2. For each extracted field, cite the source section and snippet in the evidence array
3. Normalize dates to YYYY-MM-DD format (handle German: 25.09.2025, European: 25/09/2025, English: September 25, 2025)
4. Normalize topics to the provided taxonomy (see below)
5. Extract speakers ONLY if explicitly listed as speakers/presenters/keynote speakers
6. Extract cities ONLY if they are actual city names (not topics like "Praxisnah" or "Whistleblowing")

FEW-SHOT EXAMPLES:

Example 1:
Input: "Legal Tech Conference 2025, Berlin, September 15-17, 2025. Organized by LegalTech GmbH."
Output: {
  "title": "Legal Tech Conference 2025",
  "starts_at": "2025-09-15",
  "ends_at": "2025-09-17",
  "city": "Berlin",
  "country": "DE",
  "organizer": "LegalTech GmbH",
  "topics": ["Legal Tech", "Technology"],
  "evidence": [
    {"field": "title", "source_section": "title", "snippet": "Legal Tech Conference 2025"},
    {"field": "dates", "source_section": "title", "snippet": "September 15-17, 2025"},
    {"field": "city", "source_section": "title", "snippet": "Berlin"},
    {"field": "organizer", "source_section": "title", "snippet": "Organized by LegalTech GmbH"}
  ]
}

Example 2:
Input: "Conference about AI and Machine Learning"
Output: {
  "title": "Conference about AI and Machine Learning",
  "starts_at": null,  // NOT FOUND - do not guess
  "city": null,       // NOT FOUND - do not guess
  "country": null,   // NOT FOUND - do not guess
  "topics": ["AI", "Machine Learning"],
  "evidence": [
    {"field": "title", "source_section": "title", "snippet": "Conference about AI and Machine Learning"}
  ]
}

EXTRACTION GUIDELINES:
1. DATES: Convert all dates to YYYY-MM-DD format. Look for:
   - German formats: "25. September 2025", "25. September", "25.09.2025"
   - European formats: "25/09/2025", "25-09-2025"
   - English formats: "September 25, 2025", "25 September 2025"
   - ISO formats: "2025-09-25"
   - If only year is mentioned, use null.
   
   CRITICAL: Extract ONLY the event start/end dates (when the event actually takes place).
   IGNORE these dates (do NOT extract them):
   - "Last updated" or "Last modified" dates
   - "Published" or "Posted" dates  
   - Archive dates
   - Registration deadline dates (unless they're the event date)
   - Copyright dates (e.g., "© 2025")
   - "As of" dates
   - Any date in the past that's clearly not the event date
   - Page metadata dates
   
   If you find a date without a year (e.g., "25. Mai"), only use it if:
   - It's clearly in the future relative to today
   - It's explicitly stated as the event date
   - Otherwise, use null
   
   Validate dates: If a date is clearly wrong (e.g., past event date, archive date, metadata date), use null instead.
2. LOCATIONS: Extract ONLY actual city names (Berlin, Munich, Hamburg, etc.). 
   - DO NOT use event themes, topics, or descriptions as city names
   - DO NOT use words like "Praxisnah", "Whistleblowing", "Politik", "Forschung"
   - If no clear city is mentioned, use null for city field
   - Clean venue names of extra text and addresses
3. ORGANIZATIONS: Categorize precisely based on their role in the event.
4. SPEAKERS: Extract complete professional information with context.

EXTRACT THESE ELEMENTS:

📅 EVENT DETAILS:
- title: Main event title (clean, no extra text)
- starts_at: Start date in YYYY-MM-DD format
- ends_at: End date in YYYY-MM-DD format
- city: Primary city name only
- country: Country name (full name, not code)
- venue: Venue name (clean, no addresses or extra text)
- organizer: Primary event organizer company/organization
- topics: Array of main themes/topics (3-5 key topics)

👥 SPEAKERS (extract ALL speakers mentioned):
- name: Full name
- org: Organization/company
- title: Job title/position
- speech_title: Title of their presentation/speech
- session: Session name or track
- bio: Brief professional summary (1-2 sentences)

CRITICAL: Speakers may be listed in PDF documents (programs, brochures, speaker lists) linked from the main page. 
- If the page links to a PDF (e.g., "program.pdf", "speakers.pdf", "event-brochure.pdf"), extract speakers from that PDF
- Look for speaker sections in PDFs with headings like "Speakers", "Faculty", "Presenters", "Keynote Speakers"
- Extract ALL speakers listed, including their full names, titles, organizations, and affiliations
- PDFs often contain the most complete and accurate speaker information

🏢 ORGANIZATIONS (categorize by role):
- sponsors: Financial supporters with sponsorship level (Platinum, Gold, Silver, Bronze, etc.)
- participating_organizations: Companies sending attendees or mentioned as participants
- partners: Co-organizers, collaborators, media partners, technology partners
- competitors: Rival companies in the same industry space

EVIDENCE REQUIREMENT:
For each non-null field, include an evidence tag in the evidence array with:
- field: The field name (e.g., "title", "city", "starts_at")
- source_section: Where it was found (e.g., "title", "description", "header", "body")
- snippet: The exact text snippet that contains the information (max 200 characters)

QUALITY STANDARDS:
- Only extract information explicitly mentioned on the page
- Clean all text of extra formatting, addresses, or metadata
- Use null for missing information, not empty strings
- For dates, if only year is mentioned, use null
- For venues, extract only the venue name, not full addresses
- For speakers, only include people explicitly listed as speakers/presenters
- Every non-null field MUST have a corresponding evidence tag

Locale: ${locale || hostCountry || "DE"}${industryContext}
Return structured JSON matching the schema exactly. Include evidence array for all extracted fields.`;

    // PERF-1.4.1: Check rate limit before making Firecrawl extraction API call
    // PERF-1.4.3: Automatically record response time for adaptive rate limiting
    let kicked: any;
    try {
      const { withRateLimit } = await import('@/lib/services/rate-limit-service');
      kicked = await withRateLimit('firecrawl', async () => {
        return await fetchWithRetry("https://api.firecrawl.dev/v2/extract", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [url],
        schema: EVENT_SCHEMA,
        prompt: enhancedPrompt,
        showSources: false,
        scrapeOptions: {
          onlyMainContent: true, 
          formats: ["markdown", "html", "images"], // FIRECRAWL-V2: Added images format for event image extraction
          parsers: ["pdf"], 
          waitFor: 1200,
          location: { 
            country: (locale || hostCountry || "DE").toUpperCase(), 
            languages: ["de-DE","en-GB","fr-FR","it-IT","es-ES","nl-NL","pt-PT","pl-PL"] 
          },
          blockAds: true,
          removeBase64Images: true,
          // FIRECRAWL-V2: Extract data attributes for structured data from HTML
          extractDataAttributes: true,
          // FIRECRAWL-V2: Enhanced PDF parsing with title and metadata extraction
          pdfOptions: {
            extractTitle: true,
            extractMetadata: true
          },
          crawlerOptions: {
            maxDepth: Math.min(3, (crawl?.depth ?? 3)),
            maxPagesToCrawl: 12,
            allowSubdomains: true,
            // FIRECRAWL-V2: Natural language crawling - replaces regex patterns with AI-powered page discovery
            // This is language-agnostic and automatically finds relevant pages in any language
            // IMPORTANT: Explicitly look for PDF documents (programs, brochures, speaker lists) as they often contain complete speaker information
            prompt: "Crawl pages and documents related to event details, speakers, presenters, agenda, program, schedule, registration, tickets, and venue information. CRITICAL: Also discover and crawl PDF documents (programs, brochures, speaker lists, event guides) linked from the page, as they often contain complete speaker information. Look for links to PDF files (.pdf) containing event programs, speaker lists, or detailed event information. Focus on pages and PDFs that contain event information, speaker bios, session details, and registration forms."
          }
        },
          ignoreInvalidURLs: true
        })
      }).then(r => r.json());
      }); 
    } catch (rateLimitError) {
      console.warn('[extractOne] Rate limit check failed, continuing without rate limiting:', rateLimitError);
      // Fallback: make call without rate limiting
      kicked = await fetchWithRetry("https://api.firecrawl.dev/v2/extract", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [url],
          schema: EVENT_SCHEMA,
          prompt: enhancedPrompt,
          showSources: false,
          scrapeOptions: {
            onlyMainContent: true, 
            formats: ["markdown", "html", "images"], // FIRECRAWL-V2: Added images format
            parsers: ["pdf"], 
            waitFor: 1200,
            location: { 
              country: (locale || hostCountry || "DE").toUpperCase(), 
              languages: ["de-DE","en-GB","fr-FR","it-IT","es-ES","nl-NL","pt-PT","pl-PL"] 
            },
            blockAds: true,
            removeBase64Images: true,
            // FIRECRAWL-V2: Extract data attributes for structured data from HTML
            extractDataAttributes: true,
            // FIRECRAWL-V2: Enhanced PDF parsing with title and metadata extraction
            pdfOptions: {
              extractTitle: true,
              extractMetadata: true
            },
            crawlerOptions: {
              maxDepth: Math.min(3, (crawl?.depth ?? 3)),
              maxPagesToCrawl: 12,
              allowSubdomains: true,
              // FIRECRAWL-V2: Natural language crawling - replaces regex patterns with AI-powered page discovery
              // This is language-agnostic and automatically finds relevant pages in any language
              prompt: "Crawl pages related to event details, speakers, presenters, agenda, program, schedule, registration, tickets, and venue information. Focus on pages that contain event information, speaker bios, session details, and registration forms."
            }
          },
          ignoreInvalidURLs: true
        })
      }).then(r => r.json());
    }

    if (kicked?.id) {
      const data = await pollExtract(kicked.id, key);
      const picked = pickData(data);
      if (picked) {
        // FIRECRAWL-V2: Process images and data attributes from extraction response
        const processedData = processExtractionResponse(picked, data);
        const ev = shape(url, processedData);
        const rich = ev.starts_at || ev.city || ev.country;
        trace.push({ url, step: "firecrawl", rich: !!rich });
        try {
          const supabase = await supabaseServer();
          await supabase.from("url_extractions").upsert({ url_normalized: normalizeUrl(url), payload: ev, confidence: ev.confidence ?? null, schema_version: 1 });
        } catch {}
        if (rich) return ev;
      } else {
        trace.push({ url, step: "firecrawl", rich: false });
      }
    } else {
      trace.push({ url, step: "firecrawl", rich: false, note: "no job id" });
    }
  } catch { trace.push({ url, step: "firecrawl", rich: false, note: "error" }); }

  // 3) Enhanced regex fallback (from HTML)
  if (html) {
    const text = htmlToText(html);
    const dates = parseEnhancedDates(text);
    const location = parseEnhancedLocation(text, hostCountry);
    
    // Enhanced city detection
    let city: string | null = location.city;
    if (!city) {
      const m = text.match(CITY_RE);
      if (m) city = m[1];
    }
    
    // Enhanced title extraction
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = decodeEntities(titleMatch ? titleMatch[1].replace(/\s+/g," ").trim() : null);

    // Try to extract organizer from common patterns
    let organizer: string | null = null;
    const organizerPatterns = [
      /organized by\s+([^,.\n]+)/i,
      /hosted by\s+([^,.\n]+)/i,
      /presented by\s+([^,.\n]+)/i,
      /sponsored by\s+([^,.\n]+)/i
    ];
    
    for (const pattern of organizerPatterns) {
      const match = text.match(pattern);
      if (match) {
        organizer = match[1].trim();
        break;
      }
    }

    const ev = shape(url, {
      title,
      ...dates,
      city: city || location.city,
      country: city ? (hostCountry || "Germany") : (hostCountry || location.country),
      venue: location.venue,
      organizer
    });
    const rich = ev.starts_at || ev.city || ev.country || ev.venue;
    trace.push({ url, step: "regex", rich: !!rich });
    try {
      const supabase = await supabaseServer();
      await supabase.from("url_extractions").upsert({ url_normalized: normalizeUrl(url), payload: ev, confidence: ev.confidence ?? null, schema_version: 1 });
    } catch {}
    if (rich || ev.title !== "Untitled Event") return ev;
  }

  // 4) Last resort (never return undefined)
  trace.push({ url, step: "stub", rich: false });
  const ev = shape(url, { title: null, country: hostCountry });
  try {
    const supabase = await supabaseServer();
    await supabase.from("url_extractions").upsert({ url_normalized: normalizeUrl(url), payload: ev, confidence: ev.confidence ?? null, schema_version: 1 });
  } catch {}
  return ev;
  } catch (err: any) {
    // Hard fallback on unexpected errors
    trace.push({ url, step: "exception", message: err?.message || String(err) });
    return shape(url, { title: null, country: hostCountry });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<EventExtractionResponse | ErrorResponse>> {
  try {
    const requestData: EventExtractionRequest = await req.json();
    const { urls, locale = "", crawl } = requestData;
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ version: "extract_v5", events: [], trace: [], note: "urls[] required" }, { status: 400 });
    }
    const key = process.env.FIRECRAWL_KEY;

    const trace: any[] = [];

    if (!key) {
      // No FIRECRAWL_KEY found, returning minimal events
      const out = urls.map((u: string) => shape(u, { title: null, country: guessCountryFromHost(u) }));
      return NextResponse.json({ version: "extract_v5", events: out as EventData[], trace, note: "no FIRECRAWL_KEY" });
    }

    const targets = urls.slice(0, 20);
    
    // FIRECRAWL-V2: Increased batch size from 3 to 10 for better efficiency
    // Firecrawl v2 supports larger batches, reducing API overhead
    const BATCH_SIZE_THRESHOLD = 10;
    
    // PERF-2.2.5: Use batch extraction for 10+ URLs to reduce API overhead
    // For smaller batches, use individual extraction for better error handling
    let out: any[] = [];
    
    if (targets.length >= BATCH_SIZE_THRESHOLD) {
      // Try batch extraction first
      try {
        const batchResults = await extractBatch(
          targets, 
          key, 
          locale, 
          trace, 
          req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:4000', 
          crawl
        );
        
        if (batchResults.length > 0) {
          // Process batch results
          for (const { url, data } of batchResults) {
            if (data) {
              const ev = shape(url, data);
              // Cache the result
              try {
                const supabase = await supabaseServer();
                await supabase.from("url_extractions").upsert({ 
                  url_normalized: normalizeUrl(url), 
                  payload: ev, 
                  confidence: ev.confidence ?? null, 
                  schema_version: 1 
                });
              } catch {}
              out.push(ev);
            }
          }
          
          // If batch extraction succeeded for all URLs, we're done
          if (batchResults.length === targets.length) {
            // All URLs processed via batch
          } else {
            // Some URLs failed in batch, extract remaining individually
            const processedUrls = new Set(batchResults.map(r => r.url));
            const remaining = targets.filter(u => !processedUrls.has(u));
            
            // Fall back to individual extraction for remaining URLs
            const inFlight = new Set<Promise<any>>();
            const limit = 12;
            const hostLast: Record<string, number> = {};
            const gapMs = 250;
            
            async function runOne(u: string) {
              const host = (() => { try { return new URL(u).hostname; } catch { return ""; } })();
              const last = hostLast[host] || 0;
              const wait = Math.max(0, last + gapMs - Date.now());
              if (wait > 0) await new Promise(r => setTimeout(r, wait));
              hostLast[host] = Date.now();
              const ev = await extractOne(u, key, locale, trace, req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:4000', crawl);
              out.push(ev);
            }
            
            for (const u of remaining) {
              const p = runOne(u);
              inFlight.add(p);
              p.finally(() => inFlight.delete(p));
              if (inFlight.size >= limit) {
                await Promise.race(inFlight);
              }
            }
            await Promise.all(Array.from(inFlight));
          }
        } else {
          // Batch extraction failed, fall back to individual
          throw new Error('Batch extraction returned no results');
        }
      } catch (batchError) {
        // Batch extraction failed, fall back to individual extraction
        console.warn('[extract] Batch extraction failed, falling back to individual:', batchError);
        trace.push({ step: "batch_fallback", reason: "batch_failed" });
        
        // Optimized bounded concurrency (limit 12) with per-host throttle map
        const inFlight = new Set<Promise<any>>();
        const limit = 12;
        const hostLast: Record<string, number> = {};
        const gapMs = 250; // min gap per host

        async function runOne(u: string) {
          const host = (() => { try { return new URL(u).hostname; } catch { return ""; } })();
          const last = hostLast[host] || 0;
          const wait = Math.max(0, last + gapMs - Date.now());
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
          hostLast[host] = Date.now();
          const ev = await extractOne(u, key, locale, trace, req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:4000', crawl);
          out.push(ev);
        }

        for (const u of targets) {
          const p = runOne(u);
          inFlight.add(p);
          p.finally(() => inFlight.delete(p));
          if (inFlight.size >= limit) {
            await Promise.race(inFlight);
          }
        }
        await Promise.all(Array.from(inFlight));
      }
    } else {
      // Small batches: use individual extraction for better error handling
      const inFlight = new Set<Promise<any>>();
      const limit = 12;
      const hostLast: Record<string, number> = {};
      const gapMs = 250; // min gap per host

      async function runOne(u: string) {
        const host = (() => { try { return new URL(u).hostname; } catch { return ""; } })();
        const last = hostLast[host] || 0;
        const wait = Math.max(0, last + gapMs - Date.now());
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        hostLast[host] = Date.now();
        const ev = await extractOne(u, key, locale, trace, req.nextUrl?.origin || process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:4000', crawl);
        out.push(ev);
      }

      for (const u of targets) {
        const p = runOne(u);
        inFlight.add(p);
        p.finally(() => inFlight.delete(p));
        if (inFlight.size >= limit) {
          await Promise.race(inFlight);
        }
      }
      await Promise.all(Array.from(inFlight));
    }
    
    // Filter and sort events by quality
    const filteredEvents = out
      .filter(event => {
        // Filter out low-quality events
        const confidence = event.confidence || 0;
        const title = event.title || "";
        
        // Exclude events with very low confidence or generic titles
        if (confidence < 0.3) return false;
        if ((title || '').toLowerCase() === 'event' || (title || '').toLowerCase() === 'untitled event') return false;
        
        return true;
      })
      .sort((a, b) => {
        // Sort by confidence score (highest first), then by date availability
        const confidenceA = a.confidence || 0;
        const confidenceB = b.confidence || 0;
        if (confidenceA !== confidenceB) return confidenceB - confidenceA;
        
        // If confidence is equal, prefer events with dates
        const hasDateA = a.starts_at ? 1 : 0;
        const hasDateB = b.starts_at ? 1 : 0;
        return hasDateB - hasDateA;
      });
    
    // Add quality statistics to trace
    const qualityStats = {
      totalExtracted: out.length,
      filteredCount: filteredEvents.length,
      averageConfidence: out.reduce((sum, e) => sum + (e.confidence || 0), 0) / out.length,
      highQualityCount: out.filter(e => (e.confidence || 0) >= 0.7).length
    };
    
    trace.push({ step: "quality_filter", stats: qualityStats });
    
    // Queue intelligence generation for extracted events (non-blocking)
    // Only queue high-quality events to avoid overwhelming the queue
    const highQualityEvents = filteredEvents.filter((ev: any) => 
      ev.confidence && ev.confidence > 0.7
    );
    
    for (const event of highQualityEvents.slice(0, 5)) { // Limit to top 5
      const eventId = event.id || event.source_url;
      if (eventId) {
        // Use dynamic import to avoid blocking
        import('@/lib/services/intelligence-queue').then(({ queueIntelligenceGeneration }) => {
          queueIntelligenceGeneration(eventId, 6).catch(err => {
            console.warn('Failed to queue intelligence for extracted event:', err);
          });
        }).catch(() => {
          // Ignore import errors
        });
      }
    }
    
    return NextResponse.json({ 
      version: "extract_v5", 
      events: filteredEvents, 
      trace,
      qualityStats
    });
  } catch (e: any) {
    return NextResponse.json({ version: "extract_v5", events: [], trace: [], error: e?.message || "extract failed" }, { status: 200 });
  }
}