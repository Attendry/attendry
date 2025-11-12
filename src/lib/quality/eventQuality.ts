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

export function isSolidHit(m: CandidateMeta, window: QualityWindow): { quality: number; ok: boolean } {
  const q = computeQuality(m, window);
  
  // Lenient speaker requirement: 1+ speaker OR has speaker page
  const enoughSpeakers = (m.speakersCount ?? 0) >= 1 || m.hasSpeakerPage === true;
  
  // Date requirement - be more flexible
  // Accept if: 
  // 1. Date is in window (ideal)
  // 2. OR date exists and quality is high enough (0.40+) - trust the metadata
  // 3. OR no date but quality is very high (0.50+) and has .de domain
  const hasDateInWindow = !!m.dateISO && m.dateISO >= window.from && m.dateISO <= window.to;
  const hasDateWithHighQuality = !!m.dateISO && q >= 0.40;
  const noDateButVeryHighQuality = !m.dateISO && q >= 0.50;
  const hasWhen = hasDateInWindow || hasDateWithHighQuality || noDateButVeryHighQuality;
  
  // Germany check: country, .de TLD, OR German city name in venue/city
  const deHost = DE_HOST_PATTERN.test(m.host);
  const deCity = DE_CITY_PATTERN.test(`${m.city ?? ''} ${m.venue ?? ''}`);
  const inDE = m.country === "DE" || m.country === "Germany" || deHost || deCity;
  
  // Lower quality threshold to 0.30 to allow more candidates through
  const meetsQuality = q >= 0.30;
  
  // Must have: quality, some date/high-quality signal, Germany location, and speaker info
  return {
    quality: q,
    ok: meetsQuality && hasWhen && inDE && enoughSpeakers
  };
}

export function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}
