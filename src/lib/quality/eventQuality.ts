/**
 * Event Quality Scoring System
 */

import { SearchCfg, DE_HOST_PATTERN, DE_CITY_PATTERN } from '@/config/search';

export type CandidateMeta = {
  url: string;
  host: string;
  country?: string;
  dateISO?: string;
  venue?: string;
  city?: string;
  speakersCount?: number;
  hasSpeakerPage?: boolean;
  textSample?: string;
};

export type QualityWindow = {
  from: string;
  to: string;
};

export function computeQuality(m: CandidateMeta, window: QualityWindow): number {
  let q = 0;
  const w = SearchCfg.w;
  
  // Date in range
  if (m.dateISO && m.dateISO >= window.from && m.dateISO <= window.to) {
    q += w.dateInRange;
  }
  
  // Germany targeting
  const deHost = DE_HOST_PATTERN.test(m.host);
  const deCity = DE_CITY_PATTERN.test(`${m.city ?? ''} ${m.venue ?? ''}`);
  const deCountry = m.country === "DE" || m.country === "Germany";
  if (deCountry || deHost || deCity) {
    q += w.deHostOrLang;
  }
  
  // Venue/city presence
  if ((m.venue && m.venue.length > 2) || (m.city && m.city.length > 2)) {
    q += w.hasVenueOrCity;
  }
  
  // Speaker page
  if (m.hasSpeakerPage) {
    q += w.hasSpeakerPage;
  }
  
  // Speakers count
  if ((m.speakersCount ?? 0) >= SearchCfg.minSpeakersForSolid) {
    q += w.speakersCount;
  }
  
  return Math.min(1, q);
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isSolidHit(m: CandidateMeta, window: QualityWindow): { quality: number; ok: boolean } {
  const q = computeQuality(m, window);
  
  // Lenient speaker requirement: 1+ speaker OR has speaker page
  const enoughSpeakers = (m.speakersCount ?? 0) >= 1 || m.hasSpeakerPage === true;
  
  // Check if date is wildly wrong (likely extraction error)
  // If date is >60 days outside the window, treat it as "no date" (extraction error)
  let hasReliableDate = false;
  let dateStatus = 'no-date';
  
  if (m.dateISO) {
    const daysFromStart = daysBetween(m.dateISO, window.from);
    const daysFromEnd = daysBetween(m.dateISO, window.to);
    
    // Check if date is in window
    if (m.dateISO >= window.from && m.dateISO <= window.to) {
      hasReliableDate = true;
      dateStatus = 'in-window';
    }
    // Check if date is within 60 days of window (reasonable proximity)
    else if (daysFromStart <= 60 || daysFromEnd <= 60) {
      hasReliableDate = true;
      dateStatus = 'near-window';
    }
    // Date is >60 days off - likely extraction error, ignore it
    else {
      dateStatus = 'extraction-error';
      console.log(`[quality-gate] Date ${m.dateISO} is >60 days from window ${window.from}..${window.to}, treating as extraction error`);
    }
  }
  
  // Date validation: accept if date is reliable OR if we have strong other signals
  const strongSignals = (m.speakersCount ?? 0) >= 3 && enoughSpeakers;
  const hasWhen = hasReliableDate || strongSignals || dateStatus === 'extraction-error';
  
  // Germany check: MORE LENIENT
  // Accept if: .de domain, German city, /de/ in URL path, or simply has location info
  const deHost = DE_HOST_PATTERN.test(m.host);
  const deCity = DE_CITY_PATTERN.test(`${m.city ?? ''} ${m.venue ?? ''}`);
  const deUrl = m.url.toLowerCase().includes('/de/'); // German language version
  const hasLocation = !!(m.city || m.venue);
  const inDE = m.country === "DE" || m.country === "Germany" || deHost || deCity || deUrl || hasLocation;
  
  // Very low quality threshold - rely on content filtering to handle relevance
  const meetsQuality = q >= 0.25;
  
  // PRAGMATIC RULE: If we have 5+ speakers and industry match, trust Firecrawl's search
  const trustSearchQuery = (m.speakersCount ?? 0) >= 5 && enoughSpeakers;
  
  const ok = (meetsQuality && hasWhen && inDE && enoughSpeakers) || trustSearchQuery;
  
  return {
    quality: q,
    ok
  };
}

export function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}
