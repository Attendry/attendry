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
  
  // Speaker requirement: ≥2 speakers preferred, but allow 1 speaker if quality is high enough
  // This handles cases where speaker extraction finds only 1 valid speaker but event is otherwise high quality
  const speakersCount = m.speakersCount ?? 0;
  const enoughSpeakers = speakersCount >= 2;
  const hasOneSpeakerWithHighQuality = speakersCount >= 1 && q >= 0.5;
  
  // Date validation: Adaptive tolerance based on window size
  // For short windows (14 days), be more lenient (2x window size)
  // For longer windows, use standard 30-day tolerance
  let hasReliableDate = false;
  let dateWindowStatus: 'in-window' | 'within-month' | 'extraction-error' | 'no-date' = 'no-date';
  
  if (m.dateISO) {
    const windowDays = daysBetween(window.from, window.to);
    // Tolerance: at least 2x window size, minimum 30 days, maximum 60 days
    const toleranceDays = Math.min(60, Math.max(30, windowDays * 2));
    
    const daysFromStart = daysBetween(m.dateISO, window.from);
    const daysFromEnd = daysBetween(m.dateISO, window.to);
    
    // Check if date is in window
    if (m.dateISO >= window.from && m.dateISO <= window.to) {
      hasReliableDate = true;
      dateWindowStatus = 'in-window';
    }
    // Check if date is within tolerance of window (adaptive based on window size)
    else if (daysFromStart <= toleranceDays || daysFromEnd <= toleranceDays) {
      hasReliableDate = true;
      dateWindowStatus = 'within-month';
      console.log(`[quality-gate] Date ${m.dateISO} is within ${toleranceDays} days of window ${window.from}..${window.to}, allowing with flag`);
    }
    // Date is >tolerance days off - likely extraction error, ignore it
    else {
      dateWindowStatus = 'extraction-error';
      console.log(`[quality-gate] Date ${m.dateISO} is >${toleranceDays} days from window ${window.from}..${window.to}, treating as extraction error`);
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
  // RECOMMENDATION 6: But still require country check to prevent non-DE events from bypassing filters
  const trustSearchQuery = (m.speakersCount ?? 0) >= 5 && enoughSpeakers;
  
  // Allow events with 1 speaker if quality is high enough (quality ≥ 0.5)
  // This prevents filtering out valid events where speaker extraction only found 1 speaker
  // RECOMMENDATION 6: trustSearchQuery bypass now also requires inDE check
  const ok = (meetsQuality && hasWhen && inDE && (enoughSpeakers || hasOneSpeakerWithHighQuality)) || (trustSearchQuery && inDE);
  
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
