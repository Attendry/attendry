/**
 * Unit tests for page type classifier
 */

import { classifyPageType, isObviouslyNonEvent } from '../pageType';

describe('classifyPageType', () => {
  test('identifies legal pages as non-events', () => {
    const result = classifyPageType(
      'https://example.com/terms-and-conditions',
      'Terms and Conditions'
    );
    
    expect(result.isEvent).toBe(false);
    expect(result.type).toBe('legal');
  });
  
  test('identifies blog posts as non-events', () => {
    const result = classifyPageType(
      'https://example.com/blog/post-title',
      'Blog Post Title'
    );
    
    expect(result.isEvent).toBe(false);
    expect(result.type).toBe('blog');
  });
  
  test('identifies event pages with positive signals', () => {
    const result = classifyPageType(
      'https://example.com/events/compliance-summit-2025',
      'Compliance Summit 2025',
      'Register now for the event. Agenda includes keynote speakers.'
    );
    
    expect(result.isEvent).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
  
  test('identifies event pages with schema.org markup', () => {
    const content = '{"@type":"Event","name":"Conference"}';
    const result = classifyPageType(
      'https://example.com/conference',
      'Conference',
      content
    );
    
    expect(result.isEvent).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.6);
  });
  
  test('identifies list pages with lower confidence', () => {
    const result = classifyPageType(
      'https://example.com/events',
      'All Events'
    );
    
    expect(result.type).toBe('list');
  });
});

describe('isObviouslyNonEvent', () => {
  test('returns true for legal pages', () => {
    expect(isObviouslyNonEvent('https://example.com/privacy')).toBe(true);
    expect(isObviouslyNonEvent('https://example.com/terms')).toBe(true);
    expect(isObviouslyNonEvent('https://example.com/impressum')).toBe(true);
  });
  
  test('returns false for event pages', () => {
    expect(isObviouslyNonEvent('https://example.com/event/summit-2025')).toBe(false);
    expect(isObviouslyNonEvent('https://example.com/speakers')).toBe(false);
  });
});

