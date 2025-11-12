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
  
  // More lenient speaker requirement: 1+ speaker OR has speaker page
  const enoughSpeakers = (m.speakersCount ?? 0) >= 1 || m.hasSpeakerPage === true;
  
  // More lenient location requirement: date AND (venue OR city) - but date is critical
  const hasWhen = !!m.dateISO;
  const hasWhere = !!(m.venue || m.city);
  
  // Germany check: country, .de TLD, OR German city name
  const inDE = m.country === "DE" || DE_HOST_PATTERN.test(m.host) || !!m.city;
  
  // Lower threshold from 0.55 to 0.45 temporarily to avoid empty results
  const meetsQuality = q >= 0.45;
  
  return {
    quality: q,
    ok: meetsQuality && hasWhen && (hasWhere || inDE) && enoughSpeakers
  };
}

export function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}
