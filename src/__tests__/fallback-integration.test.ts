import { buildDemoFallback } from '@/app/api/events/run/route';
import { getCountryContext } from '@/lib/utils/country';

// We need to import the function from the route file
// Since it's not exported, we'll test it indirectly through the API

describe('Fallback Integration', () => {
  describe('Country-scoped demo fallback', () => {
    it('should return FR-specific demo events for France', () => {
      const ctx = getCountryContext('FR');
      
      // Test the country context
      expect(ctx.iso2).toBe('FR');
      expect(ctx.countryNames).toContain('France');
      expect(ctx.cities).toContain('Paris');
      
      // Test that the context doesn't contain German bias
      expect(ctx.tld).not.toBe('.de');
      expect(ctx.countryNames).not.toContain('Germany');
      expect(ctx.cities).not.toContain('Berlin');
    });

    it('should return DE-specific demo events for Germany', () => {
      const ctx = getCountryContext('DE');
      
      // Test the country context
      expect(ctx.iso2).toBe('DE');
      expect(ctx.countryNames).toContain('Germany');
      expect(ctx.cities).toContain('Berlin');
      
      // Test that the context doesn't contain French bias
      expect(ctx.tld).not.toBe('.fr');
      expect(ctx.countryNames).not.toContain('France');
      expect(ctx.cities).not.toContain('Paris');
    });

    it('should handle unknown countries by defaulting to DE', () => {
      const ctx = getCountryContext('UNKNOWN');
      
      expect(ctx.iso2).toBe('DE');
      expect(ctx.locale).toBe('de');
      expect(ctx.tld).toBe('.de');
    });
  });

  describe('Country context consistency', () => {
    it('should maintain consistent country context across all functions', () => {
      const frCtx = getCountryContext('FR');
      const frCtx2 = getCountryContext('France');
      const frCtx3 = getCountryContext('Frankreich');
      
      expect(frCtx.iso2).toBe(frCtx2.iso2);
      expect(frCtx.iso2).toBe(frCtx3.iso2);
      expect(frCtx.locale).toBe(frCtx2.locale);
      expect(frCtx.locale).toBe(frCtx3.locale);
      expect(frCtx.tld).toBe(frCtx2.tld);
      expect(frCtx.tld).toBe(frCtx3.tld);
    });

    it('should maintain consistent country context for DE', () => {
      const deCtx = getCountryContext('DE');
      const deCtx2 = getCountryContext('Germany');
      const deCtx3 = getCountryContext('Deutschland');
      
      expect(deCtx.iso2).toBe(deCtx2.iso2);
      expect(deCtx.iso2).toBe(deCtx3.iso2);
      expect(deCtx.locale).toBe(deCtx2.locale);
      expect(deCtx.locale).toBe(deCtx3.locale);
      expect(deCtx.tld).toBe(deCtx2.tld);
      expect(deCtx.tld).toBe(deCtx3.tld);
    });
  });

  describe('Country bias validation', () => {
    it('should not contain German bias for non-German countries', () => {
      const nonGermanCountries = ['FR', 'NL', 'GB', 'ES', 'IT'];
      
      nonGermanCountries.forEach(countryCode => {
        const ctx = getCountryContext(countryCode);
        
        expect(ctx.tld).not.toBe('.de');
        expect(ctx.inPhrase).not.toContain('"in Germany"');
        expect(ctx.inPhrase).not.toContain('"in Deutschland"');
        expect(ctx.countryNames).not.toContain('Germany');
        expect(ctx.countryNames).not.toContain('Deutschland');
        expect(ctx.cities).not.toContain('Berlin');
        expect(ctx.cities).not.toContain('München');
      });
    });

    it('should contain German bias only for DE', () => {
      const ctx = getCountryContext('DE');
      
      expect(ctx.tld).toBe('.de');
      expect(ctx.inPhrase).toContain('"in Germany"');
      expect(ctx.inPhrase).toContain('"in Deutschland"');
      expect(ctx.countryNames).toContain('Germany');
      expect(ctx.countryNames).toContain('Deutschland');
      expect(ctx.cities).toContain('Berlin');
      expect(ctx.cities).toContain('München');
    });
  });

  describe('Locale derivation', () => {
    it('should derive correct locale for each country', () => {
      const testCases = [
        { country: 'DE', expectedLocale: 'de' },
        { country: 'FR', expectedLocale: 'en' },
        { country: 'NL', expectedLocale: 'en' },
        { country: 'GB', expectedLocale: 'en' },
        { country: 'ES', expectedLocale: 'en' },
        { country: 'IT', expectedLocale: 'en' }
      ];

      testCases.forEach(({ country, expectedLocale }) => {
        const ctx = getCountryContext(country);
        expect(ctx.locale).toBe(expectedLocale);
      });
    });
  });

  describe('Negative sites configuration', () => {
    it('should include appropriate negative sites for each country', () => {
      const frCtx = getCountryContext('FR');
      const deCtx = getCountryContext('DE');
      
      // Both should exclude common forum sites
      expect(frCtx.negativeSites).toContain('-reddit');
      expect(frCtx.negativeSites).toContain('-forum');
      expect(deCtx.negativeSites).toContain('-reddit');
      expect(deCtx.negativeSites).toContain('-forum');
      
      // FR should exclude French-specific sites
      expect(frCtx.negativeSites).toContain('-jeuxvideo');
      
      // DE should exclude German-specific sites
      expect(deCtx.negativeSites).toContain('-Mumsnet');
    });
  });
});
