/**
 * Tests for integrated event pipeline (Phases 1-4)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  preFilterAggregators,
  filterEventSpeakers,
  createSmartChunks,
  type SearchParams
} from './integrated-event-pipeline';

describe('Phase 3: Pre-filter Aggregators', () => {
  it('should filter out aggregator domains', () => {
    const urls = [
      'https://example.com/event',
      'https://vendelux.com/event/123',
      'https://10times.com/event/456',
      'https://conference-site.de/programm'
    ];
    
    const result = preFilterAggregators(urls);
    
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain('https://example.com/event');
    expect(result.urls).toContain('https://conference-site.de/programm');
    expect(result.aggregatorDropped).toBe(2);
    expect(result.backstopKept).toBe(0);
  });
  
  it('should keep backstop aggregator when too few non-aggregators', () => {
    const urls = [
      'https://example.com/event',  // Only 1 non-aggregator
      'https://vendelux.com/event/1',
      'https://10times.com/event/2',
      'https://linkedin.com/events/3'
    ];
    
    const result = preFilterAggregators(urls);
    
    // Should keep 1 non-aggregator + 1 aggregator backstop
    expect(result.urls).toHaveLength(2);
    expect(result.backstopKept).toBe(1);
    expect(result.aggregatorDropped).toBe(2); // 3 aggregators - 1 kept
  });
  
  it('should handle all aggregators', () => {
    const urls = [
      'https://vendelux.com/event/1',
      'https://10times.com/event/2'
    ];
    
    const result = preFilterAggregators(urls);
    
    // Should keep 1 as backstop
    expect(result.urls).toHaveLength(1);
    expect(result.backstopKept).toBe(1);
  });
  
  it('should handle all non-aggregators', () => {
    const urls = [
      'https://conference-site.de/event',
      'https://privacy-summit.com/2025',
      'https://compliance-day.org/speakers'
    ];
    
    const result = preFilterAggregators(urls);
    
    expect(result.urls).toHaveLength(3);
    expect(result.aggregatorDropped).toBe(0);
    expect(result.backstopKept).toBe(0);
  });
  
  it('should handle empty input', () => {
    const result = preFilterAggregators([]);
    
    expect(result.urls).toHaveLength(0);
    expect(result.aggregatorDropped).toBe(0);
  });
});

describe('Phase 2: Filter Event Speakers', () => {
  it('should filter non-person speakers', () => {
    const events = [
      {
        title: 'Privacy Conference',
        starts_at: '2025-11-15',
        url: 'https://example.com/event',
        speakers: [
          { name: 'Dr. Andrea Müller', role: 'Privacy Officer' },
          { name: 'Privacy Summit' },  // Non-person
          { name: 'Sebastian Koch', role: 'Compliance Lead' },
          { name: 'Reserve Seat' },  // Non-person
          { name: 'Resource Center' }  // Non-person
        ]
      }
    ];
    
    const result = filterEventSpeakers(events as any);
    
    expect(result.events).toHaveLength(1);
    expect(result.events[0].speakers).toHaveLength(2);
    expect(result.events[0].speakers?.map(s => s.name)).toEqual([
      'Dr. Andrea Müller',
      'Sebastian Koch'
    ]);
    expect(result.nonPersonsFiltered).toBe(3);
  });
  
  it('should handle events with no speakers', () => {
    const events = [
      {
        title: 'Event 1',
        starts_at: '2025-11-15',
        url: 'https://example.com/1',
        speakers: []
      },
      {
        title: 'Event 2',
        starts_at: '2025-11-16',
        url: 'https://example.com/2'
        // No speakers field
      }
    ];
    
    const result = filterEventSpeakers(events as any);
    
    expect(result.events).toHaveLength(2);
    expect(result.nonPersonsFiltered).toBe(0);
  });
  
  it('should preserve speaker metadata (role, org, url)', () => {
    const events = [
      {
        title: 'Conference',
        starts_at: '2025-11-15',
        url: 'https://example.com/event',
        speakers: [
          {
            name: 'Dr. Thomas Weber',
            role: 'CEO',
            org: 'ACME GmbH',
            url: 'https://example.com/thomas'
          }
        ]
      }
    ];
    
    const result = filterEventSpeakers(events as any);
    
    expect(result.events[0].speakers).toHaveLength(1);
    expect(result.events[0].speakers?.[0]).toMatchObject({
      name: 'Dr. Thomas Weber',
      role: 'CEO',
      org: 'ACME GmbH',
      url: 'https://example.com/thomas'
    });
  });
  
  it('should handle all non-persons', () => {
    const events = [
      {
        title: 'Event',
        starts_at: '2025-11-15',
        url: 'https://example.com/event',
        speakers: [
          { name: 'Privacy Summit' },
          { name: 'User Forum' },
          { name: 'Reserve Seat' }
        ]
      }
    ];
    
    const result = filterEventSpeakers(events as any);
    
    expect(result.events[0].speakers).toHaveLength(0);
    expect(result.nonPersonsFiltered).toBe(3);
  });
});

describe('Smart Chunking with Speaker Prioritization', () => {
  it('should prioritize speaker sections', () => {
    const content = `
# Privacy Conference 2025

Welcome to our conference.

## Speakers

Dr. Andrea Müller - Privacy Officer
Sebastian Koch - Compliance Lead

## Venue

Conference Center Berlin
Main Street 123

## Schedule

Day 1: Registration
Day 2: Talks
    `;
    
    const chunks = createSmartChunks(content, 6);
    
    expect(chunks.length).toBeGreaterThan(0);
    // First chunk should contain speaker section
    expect(chunks[0]).toContain('Dr. Andrea Müller');
    expect(chunks[0]).toContain('Sebastian Koch');
  });
  
  it('should handle German speaker headings', () => {
    const content = `
# Datenschutz Konferenz 2025

## Referenten

Dr. Andrea Müller - Datenschutzbeauftragte
Sebastian Koch - Compliance Manager

## Ort

Konferenzzentrum Berlin
    `;
    
    const chunks = createSmartChunks(content, 6);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toContain('Dr. Andrea Müller');
  });
  
  it('should fallback to generic chunking when no speaker sections', () => {
    const content = `
# Conference Info

This is general information about the conference.
No speaker section here.

## Venue

Location details...

## Schedule

Timeline...
    `.repeat(10); // Make it long enough to need chunking
    
    const chunks = createSmartChunks(content, 3);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThanOrEqual(3);
  });
  
  it('should split large speaker sections', () => {
    const longSpeakerContent = `
## Speakers

${'Dr. Speaker Name - Role\n'.repeat(1000)} 
    `;
    
    const chunks = createSmartChunks(longSpeakerContent, 10);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.length <= 12000)).toBe(true);
  });
  
  it('should respect maxChunks limit', () => {
    const content = `
## Speakers Section 1
Content...

## Speakers Section 2
Content...

## Speakers Section 3
Content...

## Speakers Section 4
Content...
    `;
    
    const chunks = createSmartChunks(content, 2);
    
    expect(chunks.length).toBeLessThanOrEqual(2);
  });
});

describe('Integration: Discovery → Filter → Extract', () => {
  it('should process URLs through complete pipeline', async () => {
    // Mock URLs from discovery
    const rawUrls = [
      'https://privacy-summit.de/2025',
      'https://vendelux.com/event/123',  // Aggregator
      'https://compliance-conference.de/speakers',
      'https://10times.com/event/456'  // Aggregator
    ];
    
    // Phase 3: Pre-filter
    const { urls: filtered } = preFilterAggregators(rawUrls);
    
    expect(filtered).toHaveLength(2);
    expect(filtered).not.toContain('https://vendelux.com/event/123');
    expect(filtered).not.toContain('https://10times.com/event/456');
    
    // Mock extracted events (would come from extraction phase)
    const extractedEvents = [
      {
        title: 'Privacy Summit',
        starts_at: '2025-11-15',
        url: filtered[0],
        speakers: [
          { name: 'Dr. Andrea Müller' },
          { name: 'Privacy Summit' },  // Non-person
          { name: 'Sebastian Koch' }
        ]
      },
      {
        title: 'Compliance Conference',
        starts_at: '2025-11-16',
        url: filtered[1],
        speakers: [
          { name: 'Thomas Weber' },
          { name: 'Reserve Seat' },  // Non-person
          { name: 'Christina Schmidt' }
        ]
      }
    ];
    
    // Phase 2: Filter speakers
    const { events: finalEvents, nonPersonsFiltered } = filterEventSpeakers(extractedEvents as any);
    
    expect(finalEvents).toHaveLength(2);
    expect(finalEvents[0].speakers).toHaveLength(2); // 2 valid out of 3
    expect(finalEvents[1].speakers).toHaveLength(2); // 2 valid out of 3
    expect(nonPersonsFiltered).toBe(2);
    
    // Verify no non-persons in final results
    const allSpeakerNames = finalEvents.flatMap(e => 
      e.speakers?.map(s => s.name) || []
    );
    
    expect(allSpeakerNames).not.toContain('Privacy Summit');
    expect(allSpeakerNames).not.toContain('Reserve Seat');
  });
});

