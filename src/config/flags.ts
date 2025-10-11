/**
 * Feature Flags Configuration
 * 
 * Controls AI ranking and speaker extraction to prevent timeouts
 */

export const FLAGS = {
  aiRankingEnabled: false,
  speakerExtractionEnabled: false,
  BYPASS_GEMINI_JSON_STRICT: false,
  ALLOW_UNDATED: false,
  RELAX_COUNTRY: false,
  RELAX_DATE: false,
  ENABLE_CURATION_TIER: false,
  ENABLE_TLD_PREFERENCE: false,
  MAX_QUERY_TIERS: 3,
  MIN_KEEP_AFTER_PRIOR: 2,
  TBS_WINDOW_DAYS: 30,
  FIRECRAWL_LIMIT: 10
};