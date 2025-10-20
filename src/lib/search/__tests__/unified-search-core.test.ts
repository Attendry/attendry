/**
 * Tests for Unified Search Core
 */

import { unifiedSearch, getUnifiedSearchStats, clearUnifiedSearchCache } from '../unified-search-core';

describe('Unified Search Core', () => {
  beforeEach(() => {
    clearUnifiedSearchCache();
  });

  it('should fallback to database when no API keys are provided', async () => {
    // Mock environment without API keys
    const originalFirecrawlKey = process.env.FIRECRAWL_KEY;
    const originalGoogleCseKey = process.env.GOOGLE_CSE_KEY;
    const originalGoogleCseCx = process.env.GOOGLE_CSE_CX;
    
    delete process.env.FIRECRAWL_KEY;
    delete process.env.GOOGLE_CSE_KEY;
    delete process.env.GOOGLE_CSE_CX;

    const result = await unifiedSearch({
      q: 'legal compliance conference',
      country: 'DE'
    });

    // Should fallback to database and return sample URLs
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.providers).toContain('firecrawl');
    expect(result.providers).toContain('cse');
    expect(result.providers).toContain('database');
    expect(result.totalItems).toBeGreaterThan(0);

    // Restore environment
    process.env.FIRECRAWL_KEY = originalFirecrawlKey;
    process.env.GOOGLE_CSE_KEY = originalGoogleCseKey;
    process.env.GOOGLE_CSE_CX = originalGoogleCseCx;
  });

  it('should provide search statistics', () => {
    const stats = getUnifiedSearchStats();
    
    expect(stats).toHaveProperty('rateLimits');
    expect(stats).toHaveProperty('cacheSize');
    expect(stats).toHaveProperty('cacheKeys');
    expect(Array.isArray(stats.cacheKeys)).toBe(true);
  });

  it('should clear cache correctly', () => {
    clearUnifiedSearchCache();
    const stats = getUnifiedSearchStats();
    expect(stats.cacheSize).toBe(0);
  });
});
