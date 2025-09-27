/**
 * Query Builder Tests
 * 
 * Prevents future creep of unsolicited augmentation terms.
 */

import { buildQueries, buildTierQueries } from '@/search/query-builder';
import { assertNoBlockedAugmentation, validateQueryProvenance } from '@/search/provenance-guard';

describe('query builder', () => {
  const base = '(compliance OR investigation OR "e-discovery" OR ediscovery OR "legal tech" OR "legal technology" OR "GDPR" OR "cybersecurity" OR "interne untersuchung" OR "compliance management")';

  beforeEach(() => {
    // Reset environment
    delete process.env.ENABLE_QUERY_AUGMENTATION;
  });

  test('default: no augmentation', () => {
    process.env.ENABLE_QUERY_AUGMENTATION = '0';
    const qs = buildQueries({ baseQuery: base, tier: 'A' });
    
    expect(qs.every(q => q.query.includes(base))).toBe(true);
    expect(qs.every(q => q.query.length <= 230)).toBe(true);
    
    // ensure banned terms are absent
    const s = qs.map(q => q.query).join(' ');
    expect(s).not.toMatch(/regtech|ESG|trade show|industry event|governance|risk management|privacy/i);
    
    // Check provenance
    const allTokens = qs.flatMap(q => q.tokens);
    expect(allTokens.every(t => t.source === 'user_config')).toBe(true);
  });

  test('augmented: only German event scaffold allowed', () => {
    process.env.ENABLE_QUERY_AUGMENTATION = '1';
    const qs = buildQueries({ baseQuery: base, tier: 'A', city: 'Berlin' });
    
    const s = qs.map(q => q.query).join(' ');
    expect(s).toMatch(/Konferenz|Kongress|Tagung|Seminar|Workshop|Forum|Symposium|Veranstaltung|Fortbildung/);
    expect(s).not.toMatch(/regtech|ESG|trade show|industry event|governance|risk management|privacy/i);
    
    // Check provenance
    const allTokens = qs.flatMap(q => q.tokens);
    const userConfigTokens = allTokens.filter(t => t.source === 'user_config');
    const augmentedTokens = allTokens.filter(t => t.source === 'augmented');
    
    expect(userConfigTokens.length).toBeGreaterThan(0);
    expect(augmentedTokens.length).toBeGreaterThan(0);
  });

  test('tier queries: no augmentation by default', () => {
    process.env.ENABLE_QUERY_AUGMENTATION = '0';
    const { tierA, tierB, tierC } = buildTierQueries(base);
    
    // All tiers should only contain the base query
    expect(tierA.every(q => q.query === `(${base})`)).toBe(true);
    expect(tierB.every(q => q.query === `(${base})`)).toBe(true);
    expect(tierC.every(q => q.query === `(${base})`)).toBe(true);
    
    // Check provenance
    const allTokens = [...tierA, ...tierB, ...tierC].flatMap(q => q.tokens);
    expect(allTokens.every(t => t.source === 'user_config')).toBe(true);
  });

  test('tier queries: augmentation when enabled', () => {
    process.env.ENABLE_QUERY_AUGMENTATION = '1';
    const { tierA, tierB, tierC } = buildTierQueries(base);
    
    // Should have multiple queries per tier
    expect(tierA.length).toBeGreaterThan(1);
    expect(tierB.length).toBeGreaterThan(1);
    expect(tierC.length).toBeGreaterThan(1);
    
    // Check provenance
    const allTokens = [...tierA, ...tierB, ...tierC].flatMap(q => q.tokens);
    const augmentedTokens = allTokens.filter(t => t.source === 'augmented');
    expect(augmentedTokens.length).toBeGreaterThan(0);
  });

  test('query length limits', () => {
    const longBase = base + ' ' + base + ' ' + base; // Make it long
    const qs = buildQueries({ baseQuery: longBase, tier: 'A' });
    
    expect(qs.every(q => q.query.length <= 230)).toBe(true);
  });

  test('provenance guard: blocks banned terms', () => {
    const tokens = [
      { text: 'compliance', source: 'user_config' },
      { text: 'regtech', source: 'augmented' }
    ];
    
    expect(() => assertNoBlockedAugmentation(tokens)).toThrow('Blocked augmentation detected: regtech');
  });

  test('provenance guard: allows user config terms', () => {
    const tokens = [
      { text: 'compliance', source: 'user_config' },
      { text: 'regtech', source: 'user_config' } // User explicitly typed this
    ];
    
    expect(() => assertNoBlockedAugmentation(tokens)).not.toThrow();
  });

  test('provenance validation: detects disabled augmentation', () => {
    process.env.ENABLE_QUERY_AUGMENTATION = '0';
    const tokens = [
      { text: 'compliance', source: 'user_config' },
      { text: 'Konferenz', source: 'augmented' }
    ];
    
    const result = validateQueryProvenance(tokens);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Augmentation is disabled. Found unexpected augmented tokens.');
  });

  test('provenance validation: allows augmentation when enabled', () => {
    process.env.ENABLE_QUERY_AUGMENTATION = '1';
    const tokens = [
      { text: 'compliance', source: 'user_config' },
      { text: 'Konferenz', source: 'augmented' }
    ];
    
    const result = validateQueryProvenance(tokens);
    expect(result.isValid).toBe(true);
  });
});
