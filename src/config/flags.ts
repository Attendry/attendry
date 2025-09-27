/**
 * Feature Flags Configuration
 * 
 * Temporary flags for debugging and preventing zero-result runs.
 * These should be tightened once we identify where results are being lost.
 */

export const FLAGS = {
  // Gemini AI bypass flags
  BYPASS_GEMINI_JSON_STRICT: process.env.BYPASS_GEMINI_JSON_STRICT === '1',
  
  // Date and country filtering relaxation
  ALLOW_UNDATED: process.env.ALLOW_UNDATED === '1',
  RELAX_COUNTRY: process.env.RELAX_COUNTRY === '1',
  RELAX_DATE: process.env.RELAX_DATE === '1',
  
  // Search tier configuration
  MAX_QUERY_TIERS: Number(process.env.MAX_QUERY_TIERS ?? 3), // 1..3
  MIN_KEEP_AFTER_PRIOR: Number(process.env.MIN_KEEP_AFTER_PRIOR ?? 5),
  TBS_WINDOW_DAYS: Number(process.env.TBS_WINDOW_DAYS ?? 45),
  FIRECRAWL_LIMIT: Number(process.env.FIRECRAWL_LIMIT ?? 25),
  
  // Advanced features
  ENABLE_CURATION_TIER: process.env.ENABLE_CURATION_TIER !== '0',
  ENABLE_TLD_PREFERENCE: process.env.ENABLE_TLD_PREFERENCE !== '0',
  
  // Debugging
  DEBUG_MODE: process.env.DEBUG_MODE === '1',
  VERBOSE_LOGGING: process.env.VERBOSE_LOGGING === '1',
} as const;

/**
 * Get flag value with type safety
 */
export function getFlag<K extends keyof typeof FLAGS>(key: K): typeof FLAGS[K] {
  return FLAGS[key];
}

/**
 * Check if any relaxation flags are enabled
 */
export function isRelaxedMode(): boolean {
  return FLAGS.RELAX_COUNTRY || FLAGS.RELAX_DATE || FLAGS.ALLOW_UNDATED || FLAGS.BYPASS_GEMINI_JSON_STRICT;
}

/**
 * Get debug configuration for search runs
 */
export function getDebugConfig() {
  return {
    bypassGemini: FLAGS.BYPASS_GEMINI_JSON_STRICT,
    allowUndated: FLAGS.ALLOW_UNDATED,
    relaxCountry: FLAGS.RELAX_COUNTRY,
    relaxDate: FLAGS.RELAX_DATE,
    maxTiers: FLAGS.MAX_QUERY_TIERS,
    minKeep: FLAGS.MIN_KEEP_AFTER_PRIOR,
    windowDays: FLAGS.TBS_WINDOW_DAYS,
    firecrawlLimit: FLAGS.FIRECRAWL_LIMIT,
    enableCuration: FLAGS.ENABLE_CURATION_TIER,
    enableTldPreference: FLAGS.ENABLE_TLD_PREFERENCE,
  };
}
