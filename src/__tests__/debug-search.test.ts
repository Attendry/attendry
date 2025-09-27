/**
 * Debug Search Tests
 * 
 * Simple tests to verify the debug search implementation.
 */

import { FLAGS } from '@/config/flags';

describe('Debug Search Implementation', () => {
  it('should have feature flags configured', () => {
    expect(FLAGS).toBeDefined();
    expect(typeof FLAGS.BYPASS_GEMINI_JSON_STRICT).toBe('boolean');
    expect(typeof FLAGS.ALLOW_UNDATED).toBe('boolean');
    expect(typeof FLAGS.RELAX_COUNTRY).toBe('boolean');
    expect(typeof FLAGS.RELAX_DATE).toBe('boolean');
  });

  it('should have search tier configuration', () => {
    expect(FLAGS.MAX_QUERY_TIERS).toBeGreaterThan(0);
    expect(FLAGS.MIN_KEEP_AFTER_PRIOR).toBeGreaterThan(0);
    expect(FLAGS.TBS_WINDOW_DAYS).toBeGreaterThan(0);
    expect(FLAGS.FIRECRAWL_LIMIT).toBeGreaterThan(0);
  });

  it('should have advanced features configured', () => {
    expect(typeof FLAGS.ENABLE_CURATION_TIER).toBe('boolean');
    expect(typeof FLAGS.ENABLE_TLD_PREFERENCE).toBe('boolean');
  });
});
