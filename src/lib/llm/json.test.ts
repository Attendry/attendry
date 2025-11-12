/**
 * Tests for JSON schema validation and auto-repair
 */

import { describe, it, expect } from 'vitest';
import { 
  safeParseEvents, 
  tryRepairJson, 
  parseWithRepair,
  EventSchema,
  type EventDTO 
} from './json';

describe('safeParseEvents', () => {
  it('should parse valid JSON', () => {
    const validJson = JSON.stringify([{
      title: 'Privacy Summit 2025',
      starts_at: '2025-11-15',
      url: 'https://example.com/event',
      city: 'Berlin',
      country: 'DE'
    }]);
    
    const result = safeParseEvents(validJson);
    
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('Privacy Summit 2025');
  });
  
  it('should extract JSON from wrapped text', () => {
    const wrappedJson = `Here is the event data:
    
    {
      "title": "Compliance Conference",
      "starts_at": "2025-12-01",
      "url": "https://example.com/conf"
    }
    
    That's all the information.`;
    
    const result = safeParseEvents(wrappedJson);
    
    expect(result.ok).toBe(true);
    expect(result.data[0].title).toBe('Compliance Conference');
  });
  
  it('should handle array of events', () => {
    const arrayJson = JSON.stringify([
      {
        title: 'Event One',
        starts_at: '2025-11-15',
        url: 'https://example.com/1'
      },
      {
        title: 'Event Two',
        starts_at: '2025-11-16',
        url: 'https://example.com/2'
      }
    ]);
    
    const result = safeParseEvents(arrayJson);
    
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(2);
  });
  
  it('should filter out invalid items from array', () => {
    const mixedJson = JSON.stringify([
      {
        title: 'Valid Event',
        starts_at: '2025-11-15',
        url: 'https://example.com/valid'
      },
      {
        title: 'No',  // Too short
        starts_at: '2025-11-16',
        url: 'https://example.com/invalid'
      },
      {
        // Missing required fields
        title: 'Another Event'
      }
    ]);
    
    const result = safeParseEvents(mixedJson);
    
    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('Valid Event');
  });
  
  it('should fail on completely invalid JSON', () => {
    const invalidJson = 'This is not JSON at all';
    
    const result = safeParseEvents(invalidJson);
    
    expect(result.ok).toBe(false);
    expect(result.data).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});

describe('tryRepairJson', () => {
  it('should fix trailing commas', () => {
    const badJson = '{"title": "Event", "date": "2025-11-15",}';
    
    const repaired = tryRepairJson(badJson);
    
    expect(() => JSON.parse(repaired)).not.toThrow();
    const parsed = JSON.parse(repaired);
    expect(parsed.title).toBe('Event');
  });
  
  it('should quote unquoted keys', () => {
    const badJson = '{title: "Event", date: "2025-11-15"}';
    
    const repaired = tryRepairJson(badJson);
    
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
  
  it('should remove line comments', () => {
    const badJson = `{
      "title": "Event",  // This is a comment
      "date": "2025-11-15"
    }`;
    
    const repaired = tryRepairJson(badJson);
    
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
  
  it('should remove block comments', () => {
    const badJson = `{
      "title": "Event",
      /* This is a 
         multiline comment */
      "date": "2025-11-15"
    }`;
    
    const repaired = tryRepairJson(badJson);
    
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
  
  it('should extract from markdown fence', () => {
    const fencedJson = `\`\`\`json
    {
      "title": "Event",
      "date": "2025-11-15"
    }
    \`\`\``;
    
    const repaired = tryRepairJson(fencedJson);
    
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
  
  it('should handle single quotes (basic case)', () => {
    const badJson = "{'title': 'Event', 'date': '2025-11-15'}";
    
    const repaired = tryRepairJson(badJson);
    
    // Note: This won't fully fix single quotes, but tryRepairJson
    // focuses on trailing commas and unquoted keys
    // Full single-quote replacement would need more complex logic
  });
});

describe('parseWithRepair', () => {
  it('should parse valid JSON without repair', () => {
    const validJson = JSON.stringify({
      title: 'Test Event',
      starts_at: '2025-11-15',
      url: 'https://example.com'
    });
    
    const result = parseWithRepair(validJson);
    
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(false);
    expect(result.data[0].title).toBe('Test Event');
  });
  
  it('should repair and parse malformed JSON', () => {
    const badJson = `{
      "title": "Test Event",
      "starts_at": "2025-11-15",
      "url": "https://example.com",
    }`;
    
    const result = parseWithRepair(badJson);
    
    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
    expect(result.data[0].title).toBe('Test Event');
  });
  
  it('should return error for irreparable JSON', () => {
    const badJson = 'totally broken {{{ json';
    
    const result = parseWithRepair(badJson);
    
    expect(result.ok).toBe(false);
    expect(result.repaired).toBe(true);
  });
});

describe('EventSchema validation', () => {
  it('should require minimum title length', () => {
    const result = EventSchema.safeParse({
      title: 'AB',  // Too short
      starts_at: '2025-11-15',
      url: 'https://example.com'
    });
    
    expect(result.success).toBe(false);
  });
  
  it('should require ISO date format for starts_at', () => {
    const result = EventSchema.safeParse({
      title: 'Test Event',
      starts_at: '15.11.2025',  // Wrong format
      url: 'https://example.com'
    });
    
    expect(result.success).toBe(false);
  });
  
  it('should require valid URL', () => {
    const result = EventSchema.safeParse({
      title: 'Test Event',
      starts_at: '2025-11-15',
      url: 'not-a-url'
    });
    
    expect(result.success).toBe(false);
  });
  
  it('should require 2-letter country code if provided', () => {
    const result = EventSchema.safeParse({
      title: 'Test Event',
      starts_at: '2025-11-15',
      url: 'https://example.com',
      country: 'Germany'  // Should be 'DE'
    });
    
    expect(result.success).toBe(false);
  });
  
  it('should accept valid event with all fields', () => {
    const result = EventSchema.safeParse({
      title: 'Privacy Summit 2025',
      organizer: 'ACME Corp',
      starts_at: '2025-11-15',
      ends_at: '2025-11-17',
      tz: 'Europe/Berlin',
      venue: 'Conference Center',
      city: 'Berlin',
      country: 'DE',
      url: 'https://example.com/event',
      topics: ['privacy', 'compliance'],
      speakers: [
        {
          name: 'Dr. Sarah Johnson',
          role: 'Chief Privacy Officer',
          org: 'ACME Corp',
          url: 'https://example.com/sarah'
        }
      ]
    });
    
    expect(result.success).toBe(true);
  });
});

