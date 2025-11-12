/**
 * Unit tests for URL resolution utilities
 */

import { toAbsoluteUrl, extractBaseHref, normalizeUrl } from '../url';

describe('toAbsoluteUrl', () => {
  const baseUrl = 'https://example.com/de/events/conference-2025';
  
  test('returns null for invalid inputs', () => {
    expect(toAbsoluteUrl('', baseUrl)).toBeNull();
    expect(toAbsoluteUrl(null, baseUrl)).toBeNull();
    expect(toAbsoluteUrl(undefined, baseUrl)).toBeNull();
    expect(toAbsoluteUrl('#', baseUrl)).toBeNull();
    expect(toAbsoluteUrl('#anchor', baseUrl)).toBeNull();
    expect(toAbsoluteUrl('javascript:void(0)', baseUrl)).toBeNull();
    expect(toAbsoluteUrl('mailto:test@test.com', baseUrl)).toBeNull();
  });
  
  test('returns absolute URLs as-is', () => {
    const absoluteUrl = 'https://other.com/page';
    expect(toAbsoluteUrl(absoluteUrl, baseUrl)).toBe(absoluteUrl);
  });
  
  test('converts relative URLs to absolute', () => {
    expect(toAbsoluteUrl('speakers', baseUrl))
      .toBe('https://example.com/de/events/speakers');
    
    expect(toAbsoluteUrl('./speakers', baseUrl))
      .toBe('https://example.com/de/events/speakers');
  });
  
  test('handles absolute paths', () => {
    expect(toAbsoluteUrl('/programm', baseUrl))
      .toBe('https://example.com/de/programm');
  });
  
  test('preserves language segments', () => {
    const germanBase = 'https://example.com/de/events';
    expect(toAbsoluteUrl('/speakers', germanBase))
      .toBe('https://example.com/de/speakers');
  });
  
  test('handles parent directory navigation', () => {
    expect(toAbsoluteUrl('../other-event', baseUrl))
      .toBe('https://example.com/de/other-event');
  });
  
  test('honors <base href>', () => {
    const documentBase = 'https://example.com/en/';
    expect(toAbsoluteUrl('speakers', baseUrl, documentBase))
      .toBe('https://example.com/en/speakers');
  });
  
  test('handles protocol-relative URLs', () => {
    expect(toAbsoluteUrl('//cdn.example.com/script.js', baseUrl))
      .toBe('https://cdn.example.com/script.js');
  });
});

describe('extractBaseHref', () => {
  test('extracts base href from HTML', () => {
    const html = '<head><base href="https://example.com/en/" /></head>';
    expect(extractBaseHref(html)).toBe('https://example.com/en/');
  });
  
  test('returns null when no base tag', () => {
    const html = '<head><title>Test</title></head>';
    expect(extractBaseHref(html)).toBeNull();
  });
});

describe('normalizeUrl', () => {
  test('removes trailing slash', () => {
    expect(normalizeUrl('https://example.com/page/'))
      .toBe('https://example.com/page');
  });
  
  test('keeps root trailing slash', () => {
    expect(normalizeUrl('https://example.com/'))
      .toBe('https://example.com/');
  });
  
  test('sorts query parameters', () => {
    expect(normalizeUrl('https://example.com?z=1&a=2'))
      .toBe('https://example.com?a=2&z=1');
  });
});

