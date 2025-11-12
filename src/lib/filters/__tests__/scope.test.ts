/**
 * Unit tests for scope filtering
 */

import { isGermanCity, isGermany, parseEventDate, passesScope } from '../scope';

describe('isGermanCity', () => {
  test('recognizes major German cities', () => {
    expect(isGermanCity('Berlin')).toBe(true);
    expect(isGermanCity('berlin')).toBe(true);
    expect(isGermanCity('München')).toBe(true);
    expect(isGermanCity('Frankfurt')).toBe(true);
  });
  
  test('handles variations', () => {
    expect(isGermanCity('Muenchen')).toBe(true);
    expect(isGermanCity('Koeln')).toBe(true);
  });
  
  test('rejects non-German cities', () => {
    expect(isGermanCity('London')).toBe(false);
    expect(isGermanCity('Paris')).toBe(false);
  });
});

describe('isGermany', () => {
  test('recognizes German country codes', () => {
    expect(isGermany('DE')).toBe(true);
    expect(isGermany('DEU')).toBe(true);
    expect(isGermany('Germany')).toBe(true);
  });
  
  test('rejects other countries', () => {
    expect(isGermany('FR')).toBe(false);
    expect(isGermany('UK')).toBe(false);
  });
});

describe('parseEventDate', () => {
  test('parses ISO format', () => {
    const date = parseEventDate('2025-11-12');
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(10); // November = 10 (0-indexed)
    expect(date?.getDate()).toBe(12);
  });
  
  test('parses German format', () => {
    const date = parseEventDate('12.11.2025');
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(10);
    expect(date?.getDate()).toBe(12);
  });
  
  test('returns null for invalid dates', () => {
    expect(parseEventDate('invalid')).toBeNull();
    expect(parseEventDate('')).toBeNull();
    expect(parseEventDate(null)).toBeNull();
  });
});

describe('passesScope', () => {
  test('passes German events within date range', () => {
    const event = {
      url: 'https://example.com/event',
      city: 'Berlin',
      countryCode: 'DE',
      startDate: '2025-11-12'
    };
    
    const filter = {
      countryCode: 'DE',
      dateFrom: '2025-11-10',
      dateTo: '2025-11-20'
    };
    
    const result = passesScope(event, filter);
    expect(result.passes).toBe(true);
  });
  
  test('rejects non-German events', () => {
    const event = {
      url: 'https://example.com/event',
      city: 'London',
      countryCode: 'UK',
      startDate: '2025-11-12'
    };
    
    const filter = {
      countryCode: 'DE',
      dateFrom: '2025-11-10',
      dateTo: '2025-11-20'
    };
    
    const result = passesScope(event, filter);
    expect(result.passes).toBe(false);
  });
  
  test('rejects global list pages by default', () => {
    const event = {
      url: 'https://example.com/events',
      countryCode: 'DE'
    };
    
    const filter = {
      countryCode: 'DE',
      allowGlobalLists: false
    };
    
    const result = passesScope(event, filter);
    expect(result.passes).toBe(false);
    expect(result.reason).toContain('list');
  });
  
  test('allows events with German city but no country code', () => {
    const event = {
      url: 'https://example.com/event',
      city: 'München',
      startDate: '2025-11-12'
    };
    
    const filter = {
      countryCode: 'DE',
      dateFrom: '2025-11-10',
      dateTo: '2025-11-20'
    };
    
    const result = passesScope(event, filter);
    expect(result.passes).toBe(true);
  });
});

