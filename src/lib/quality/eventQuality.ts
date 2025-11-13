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

export function isSolidHit(m: CandidateMeta, window: QualityWindow): { 
  quality: number; 
  ok: boolean;
  dateWindowStatus?: 'in-window' | 'within-month' | 'extraction-error' | 'no-date';
} {
  const q = computeQuality(m, window);
  
  // Speaker requirement: ≥2 speakers (as requested by user)
  const enoughSpeakers = (m.speakersCount ?? 0) >= 2;
  
  // Date validation: Allow ±1 month from window (30 days)
  let hasReliableDate = false;
  let dateWindowStatus: 'in-window' | 'within-month' | 'extraction-error' | 'no-date' = 'no-date';
  
  if (m.dateISO) {
    const daysFromStart = daysBetween(m.dateISO, window.from);
    const daysFromEnd = daysBetween(m.dateISO, window.to);
    
    // Check if date is in window
    if (m.dateISO >= window.from && m.dateISO <= window.to) {
      hasReliableDate = true;
      dateWindowStatus = 'in-window';
    }
    // Check if date is within 1 month (30 days) of window - SOFTENED REQUIREMENT
    else if (daysFromStart <= 30 || daysFromEnd <= 30) {
      hasReliableDate = true;
      dateWindowStatus = 'within-month';
      console.log(`[quality-gate] Date ${m.dateISO} is within 1 month of window ${window.from}..${window.to}, allowing with flag`);
    }
    // Date is >30 days off - likely extraction error, ignore it
    else {
      dateWindowStatus = 'extraction-error';
      console.log(`[quality-gate] Date ${m.dateISO} is >30 days from window ${window.from}..${window.to}, treating as extraction error`);
    }
  }
  
  // Date validation: accept if date is reliable OR if we have strong other signals
  const strongSignals = (m.speakersCount ?? 0) >= 3 && enoughSpeakers;
  const hasWhen = hasReliableDate || strongSignals || dateWindowStatus === 'extraction-error';
  
  // Germany check: SOFTENED - Accept if event is in Germany (country code, .de domain, or /de/ path)
  // No longer requires specific city/venue - just needs to be in Germany
  const deHost = DE_HOST_PATTERN.test(m.host);
  const deUrl = m.url.toLowerCase().includes('/de/'); // German language version
  const deCountry = m.country === "DE" || m.country === "Germany";
  // Accept if any Germany indicator is present
  const inDE = deCountry || deHost || deUrl;
  
  // Very low quality threshold - rely on content filtering to handle relevance
  const meetsQuality = q >= 0.25;
  
  // PRAGMATIC RULE: If we have 5+ speakers and industry match, trust Firecrawl's search
  const trustSearchQuery = (m.speakersCount ?? 0) >= 5 && enoughSpeakers;
  
  const ok = (meetsQuality && hasWhen && inDE && enoughSpeakers) || trustSearchQuery;
  
  return {
    quality: q,
    ok,
    dateWindowStatus
  };
}

export function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}
