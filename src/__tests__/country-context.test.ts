import { 
  toISO2Country, 
  getCountryContext, 
  deriveLocale, 
  isValidISO2Country,
  COUNTRY_CONFIG 
} from '@/lib/utils/country';

describe('Country Context', () => {
  describe('toISO2Country', () => {
    it('should normalize valid ISO2 codes', () => {
      expect(toISO2Country('DE')).toBe('DE');
      expect(toISO2Country('FR')).toBe('FR');
      expect(toISO2Country('de')).toBe('DE');
      expect(toISO2Country('fr')).toBe('FR');
    });

    it('should handle country name aliases', () => {
      expect(toISO2Country('Germany')).toBe('DE');
      expect(toISO2Country('Deutschland')).toBe('DE');
      expect(toISO2Country('France')).toBe('FR');
      expect(toISO2Country('Frankreich')).toBe('FR');
      expect(toISO2Country('Netherlands')).toBe('NL');
      expect(toISO2Country('Holland')).toBe('NL');
    });

    it('should return null for invalid inputs', () => {
      expect(toISO2Country('')).toBe(null);
      expect(toISO2Country(null)).toBe(null);
      expect(toISO2Country(undefined)).toBe(null);
      expect(toISO2Country('INVALID')).toBe(null);
      expect(toISO2Country('123')).toBe(null);
    });

    it('should handle EU as special case', () => {
      expect(toISO2Country('EU')).toBe('EU');
      expect(toISO2Country('eu')).toBe('EU');
    });
  });

  describe('getCountryContext', () => {
    it('should return correct context for FR', () => {
      const ctx = getCountryContext('FR');
      expect(ctx.iso2).toBe('FR');
      expect(ctx.locale).toBe('en');
      expect(ctx.tld).toBe('.fr');
      expect(ctx.inPhrase).toContain('"in France"');
      expect(ctx.inPhrase).toContain('"en France"');
      expect(ctx.countryNames).toContain('France');
      expect(ctx.cities).toContain('Paris');
      expect(ctx.negativeSites).toContain('-reddit');
    });

    it('should return correct context for DE', () => {
      const ctx = getCountryContext('DE');
      expect(ctx.iso2).toBe('DE');
      expect(ctx.locale).toBe('de');
      expect(ctx.tld).toBe('.de');
      expect(ctx.inPhrase).toContain('"in Germany"');
      expect(ctx.inPhrase).toContain('"in Deutschland"');
      expect(ctx.countryNames).toContain('Germany');
      expect(ctx.cities).toContain('Berlin');
      expect(ctx.negativeSites).toContain('-reddit');
    });

    it('should default to DE for unknown countries', () => {
      const ctx = getCountryContext('UNKNOWN');
      expect(ctx.iso2).toBe('DE');
      expect(ctx.locale).toBe('de');
    });

    it('should handle aliases correctly', () => {
      const ctx1 = getCountryContext('Germany');
      const ctx2 = getCountryContext('DE');
      expect(ctx1.iso2).toBe(ctx2.iso2);
      expect(ctx1.locale).toBe(ctx2.locale);
    });
  });

  describe('deriveLocale', () => {
    it('should return correct locale for countries', () => {
      expect(deriveLocale('DE')).toBe('de');
      expect(deriveLocale('FR')).toBe('en');
      expect(deriveLocale('GB')).toBe('en');
      expect(deriveLocale('NL')).toBe('en');
    });

    it('should respect explicit locale override', () => {
      expect(deriveLocale('FR', 'de')).toBe('de');
      expect(deriveLocale('DE', 'en')).toBe('en');
    });

    it('should default to en for unknown countries', () => {
      expect(deriveLocale('UNKNOWN')).toBe('en');
      expect(deriveLocale('EU')).toBe('en');
    });

    it('should default to en for null/undefined', () => {
      expect(deriveLocale(null)).toBe('en');
      expect(deriveLocale(undefined)).toBe('en');
    });
  });

  describe('isValidISO2Country', () => {
    it('should validate correct ISO2 codes', () => {
      expect(isValidISO2Country('DE')).toBe(true);
      expect(isValidISO2Country('FR')).toBe(true);
      expect(isValidISO2Country('NL')).toBe(true);
    });

    it('should reject invalid inputs', () => {
      expect(isValidISO2Country('')).toBe(false);
      expect(isValidISO2Country(null)).toBe(false);
      expect(isValidISO2Country(undefined)).toBe(false);
      expect(isValidISO2Country('INVALID')).toBe(false);
      expect(isValidISO2Country(123)).toBe(false);
    });
  });

  describe('COUNTRY_CONFIG', () => {
    it('should have correct structure for all countries', () => {
      Object.values(COUNTRY_CONFIG).forEach(ctx => {
        expect(ctx.iso2).toMatch(/^[A-Z]{2}$/);
        expect(['de', 'en']).toContain(ctx.locale);
        expect(ctx.tld).toMatch(/^\.[a-z]{2,3}$/);
        expect(ctx.inPhrase).toContain('"in ');
        expect(Array.isArray(ctx.countryNames)).toBe(true);
        expect(Array.isArray(ctx.cities)).toBe(true);
        expect(Array.isArray(ctx.negativeSites)).toBe(true);
        expect(ctx.countryNames.length).toBeGreaterThan(0);
        expect(ctx.cities.length).toBeGreaterThan(0);
      });
    });

    it('should not contain German bias for non-German countries', () => {
      const frCtx = COUNTRY_CONFIG.FR;
      expect(frCtx.tld).not.toBe('.de');
      expect(frCtx.inPhrase).not.toContain('Deutschland');
      expect(frCtx.countryNames).not.toContain('Germany');
      expect(frCtx.cities).not.toContain('Berlin');
    });

    it('should contain German bias only for DE', () => {
      const deCtx = COUNTRY_CONFIG.DE;
      expect(deCtx.tld).toBe('.de');
      expect(deCtx.inPhrase).toContain('Deutschland');
      expect(deCtx.countryNames).toContain('Germany');
      expect(deCtx.cities).toContain('Berlin');
    });
  });
});
