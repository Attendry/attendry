/**
 * Event Quality Scoring System
 * Scores candidates based on date, location, speakers, and content quality
 */

import { SearchCfg, DE_HOST_PATTERN, DE_CITY_PATTERN, OFFICIAL_HINTS, BLOG_HINTS } from '@/config/search';

export type CandidateMeta = {
  url: string;
  host: string;
  lang?: "de" | "en" | string;
  country?: string;           // ISO-2 if known
  dateISO?: string;           // YYYY-MM-DD if parsed early
  venue?: string;
  city?: string;
  speakersCount?: number;     // from manual/LLM, may be 0/undefined at first
  hasSpeakerPage?: boolean;   // from subpage discovery
  isOfficialDomain?: boolean; // organizer site heuristic
  textSample?: string;        // optional, small slice
};

export type QualityWindow = {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
};

export type QualityResult = {
  quality: number;
  ok: boolean;
  reasons: string[];
};

/**
 * Infer if a domain/page is an official event organizer site
 * vs an aggregator or news site
 */
export function inferIsOfficial(host: string, text?: string): boolean {
  if (!host) return false;
  
  // Reject if explicitly an aggregator
  const isAggregator = SearchCfg.aggregators.some(agg => 
    host.includes(agg) || agg.includes(host)
  );
  if (isAggregator) return false;
  
  // Reject blog/news content
  if (text && BLOG_HINTS.test(text)) return false;
  
  // Accept if has official markers
  if (text && OFFICIAL_HINTS.test(text)) return true;
  
  // Generic event aggregators have "events" in domain
  const hasGenericEventName = /\b(events|event|conference|summit|alert|meetup)\b/i.test(host);
  
  // If domain doesn't have generic event keywords, likely official
  return !hasGenericEventName;
}

/**
 * Compute quality score for a candidate
 * Returns 0-1, higher = better quality
 */
export function computeQuality(m: CandidateMeta, window: QualityWindow): number {
  let q = 0;
  const w = SearchCfg.w;
  
  // (1) Date in range - CRITICAL
  if (m.dateISO && m.dateISO >= window.from && m.dateISO <= window.to) {
    q += w.dateInRange;
  }
  
  // (2) Germany targeting
  const deHost = DE_HOST_PATTERN.test(m.host);
  const deCity = DE_CITY_PATTERN.test(`${m.city ?? ''} ${m.venue ?? ''} ${m.textSample ?? ''}`);
  const deCountry = m.country === "DE" || m.country === "Germany";
  const deOk = deCountry || deHost || deCity;
  
  if (deOk) {
    q += w.deHostOrLang;
  }
  
  // (3) Venue/city presence - indicates real physical event
  const hasLocation = (m.venue && m.venue.length > 2) || (m.city && m.city.length > 2);
  if (hasLocation) {
    q += w.hasVenueOrCity;
  }
  
  // (4) Speaker page presence - strong signal
  if (m.hasSpeakerPage) {
    q += w.hasSpeakerPage;
  }
  
  // (5) Speakers count - validated speakers found
  if ((m.speakersCount ?? 0) >= SearchCfg.minSpeakersForSolid) {
    q += w.speakersCount;
  }
  
  // (6) Official domain heuristic
  const official = m.isOfficialDomain ?? inferIsOfficial(m.host, m.textSample);
  if (official) {
    q += w.officialDomain;
  }
  
  return Math.min(1, q);
}

/**
 * Determine if a candidate is a "solid hit" worth extracting/returning
 */
export function isSolidHit(m: CandidateMeta, window: QualityWindow): QualityResult {
  const q = computeQuality(m, window);
  const reasons: string[] = [];
  
  // Check core requirements
  const enoughSpeakers = (m.speakersCount ?? 0) >= SearchCfg.minSpeakersForSolid || m.hasSpeakerPage === true;
  const hasWhenWhere = !!(m.dateISO && (m.venue || m.city));
  const inDE = m.country === "DE" || DE_HOST_PATTERN.test(m.host) || !!m.city;
  
  if (q < SearchCfg.minQualityToExtract) {
    reasons.push(`quality=${q.toFixed(2)} < ${SearchCfg.minQualityToExtract}`);
  }
  
  if (!hasWhenWhere) {
    reasons.push('missing date or location');
  }
  
  if (!inDE) {
    reasons.push('not in Germany');
  }
  
  if (!enoughSpeakers) {
    reasons.push(`speakers=${m.speakersCount ?? 0} < ${SearchCfg.minSpeakersForSolid} and no speaker page`);
  }
  
  const ok = q >= SearchCfg.minQualityToExtract && hasWhenWhere && inDE && enoughSpeakers;
  
  return {
    quality: q,
    ok,
    reasons: ok ? [] : reasons
  };
}

/**
 * Check if content contains bad phrases (404, legal, etc.)
 */
export function hasBadContent(text: string): boolean {
  if (!text || text.length < 100) return true; // Too short = likely error page
  
  const lowerText = text.toLowerCase();
  return SearchCfg.badPhrases.some(phrase => lowerText.includes(phrase.toLowerCase()));
}

/**
 * Check if URL looks like a blog post or news article
 */
export function isBlogOrNews(url: string): boolean {
  const lower = url.toLowerCase();
  
  // Common blog/news patterns
  if (/\/blog\//i.test(lower)) return true;
  if (/\/news\//i.test(lower)) return true;
  if (/\/article\//i.test(lower)) return true;
  if (/\/post\//i.test(lower)) return true;
  if (/\/press\//i.test(lower)) return true;
  
  // Date in path often indicates news/blog (e.g., /2024/11/15/article-title)
  if (/\/\d{4}\/\d{1,2}\/\d{1,2}\//i.test(lower)) {
    // Unless it has agenda/program markers
    if (!/\/(agenda|program|schedule|speakers|referenten)/i.test(lower)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract host from URL safely
 */
export function extractHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

