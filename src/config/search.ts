/**
 * Search Pipeline Configuration
 * Controls quality gates, auto-expansion, and content filtering
 */

export const SearchCfg = {
  // Minimum solid hits before auto-expanding date window
  minSolidHits: Number(process.env.MIN_SOLID_HITS ?? 3),
  
  // Voyage rerank limits
  maxVoyageDocs: Number(process.env.RERANK_MAX_DOCS ?? 40),
  voyageTopK: Number(process.env.RERANK_TOP_K ?? 12),
  
  // Auto-expand date window if insufficient results
  allowAutoExpand: (process.env.AUTO_EXPAND ?? "true") === "true",
  
  // Quality score weights (must sum to ~1.0)
  w: {
    officialDomain: 0.15,
    hasSpeakerPage: 0.20,
    deHostOrLang: 0.10,
    dateInRange: 0.25,
    hasVenueOrCity: 0.15,
    speakersCount: 0.15
  },
  
  // Quality thresholds
  minQualityToExtract: Number(process.env.MIN_QUALITY_TO_EXTRACT ?? 0.55),
  minSpeakersForSolid: Number(process.env.MIN_SPEAKERS_FOR_SOLID ?? 2),
  
  // Backstop: keep one aggregator if too few non-aggregators
  minNonAggregatorUrls: 6,
  maxBackstopAggregators: 1
} as const;

export const DE_HOST_PATTERN = /\.de$/i;
export const DE_CITY_PATTERN = /\b(berlin|münchen|munich|frankfurt|köln|cologne|hamburg|stuttgart|düsseldorf|leipzig|hannover)\b/i;
