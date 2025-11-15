/**
 * Competitive Intelligence Service Tests
 * 
 * Phase 2C: Tests for competitor detection, activity comparison, and alert generation
 */

import {
  detectCompetitorsInEvent,
  compareUserActivity,
  generateCompetitiveAlerts,
  type CompetitorMatch,
  type CompetitiveContext,
  type CompetitiveAlert
} from '../competitive-intelligence-service';
import { EventData, SpeakerData, SponsorData } from '@/lib/types/core';

// Mock data
const mockEvent: EventData = {
  id: 'test-event-1',
  source_url: 'https://example.com/event1',
  title: 'Tech Conference 2024',
  starts_at: '2024-06-15T10:00:00Z',
  speakers: [
    {
      name: 'John Doe',
      org: 'Competitor Corp',
      title: 'CTO'
    },
    {
      name: 'Jane Smith',
      org: 'Another Company',
      title: 'CEO'
    }
  ],
  sponsors: [
    {
      name: 'Competitor Corp',
      level: 'gold'
    },
    {
      name: 'Tech Solutions Inc',
      level: 'silver'
    }
  ],
  participating_organizations: ['Competitor Corp', 'Tech Solutions Inc', 'Other Company'],
  organizer: 'Event Organizers Ltd'
};

const mockCompetitors = ['Competitor Corp', 'Tech Solutions Inc'];

describe('Competitive Intelligence Service', () => {
  describe('detectCompetitorsInEvent', () => {
    it('should detect competitors in speakers', async () => {
      const matches = await detectCompetitorsInEvent(mockEvent, ['Competitor Corp']);
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(m => m.competitorName === 'Competitor Corp' && m.matchType === 'speaker')).toBe(true);
    });

    it('should detect competitors in sponsors', async () => {
      const matches = await detectCompetitorsInEvent(mockEvent, ['Competitor Corp']);
      
      expect(matches.some(m => m.competitorName === 'Competitor Corp' && m.matchType === 'sponsor')).toBe(true);
    });

    it('should detect competitors in attendees/organizations', async () => {
      const matches = await detectCompetitorsInEvent(mockEvent, ['Competitor Corp']);
      
      expect(matches.some(m => m.competitorName === 'Competitor Corp' && m.matchType === 'attendee')).toBe(true);
    });

    it('should detect competitors in organizer', async () => {
      const eventWithOrganizer: EventData = {
        ...mockEvent,
        organizer: 'Competitor Corp'
      };
      
      const matches = await detectCompetitorsInEvent(eventWithOrganizer, ['Competitor Corp']);
      
      expect(matches.some(m => m.competitorName === 'Competitor Corp' && m.matchType === 'organizer')).toBe(true);
    });

    it('should handle fuzzy matching', async () => {
      const event: EventData = {
        ...mockEvent,
        speakers: [
          {
            name: 'John Doe',
            org: 'Competitor Corp. Inc.',
            title: 'CTO'
          }
        ]
      };
      
      const matches = await detectCompetitorsInEvent(event, ['Competitor Corp']);
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchConfidence).toBeGreaterThan(0.5);
    });

    it('should return empty array when no competitors found', async () => {
      const matches = await detectCompetitorsInEvent(mockEvent, ['Non-Existent Company']);
      
      expect(matches).toEqual([]);
    });

    it('should return empty array when competitors list is empty', async () => {
      const matches = await detectCompetitorsInEvent(mockEvent, []);
      
      expect(matches).toEqual([]);
    });

    it('should handle events with no speakers/sponsors/attendees', async () => {
      const emptyEvent: EventData = {
        id: 'empty-event',
        source_url: 'https://example.com/empty',
        title: 'Empty Event',
        speakers: [],
        sponsors: [],
        participating_organizations: []
      };
      
      const matches = await detectCompetitorsInEvent(emptyEvent, mockCompetitors);
      
      expect(matches).toEqual([]);
    });

    it('should deduplicate matches', async () => {
      const event: EventData = {
        ...mockEvent,
        speakers: [
          { name: 'John', org: 'Competitor Corp', title: 'CTO' }
        ],
        sponsors: [
          { name: 'Competitor Corp', level: 'gold' }
        ],
        participating_organizations: ['Competitor Corp']
      };
      
      const matches = await detectCompetitorsInEvent(event, ['Competitor Corp']);
      
      // Should have multiple match types but deduplicated
      const competitorMatches = matches.filter(m => m.competitorName === 'Competitor Corp');
      expect(competitorMatches.length).toBeGreaterThan(0);
    });

    it('should calculate confidence scores correctly', async () => {
      const matches = await detectCompetitorsInEvent(mockEvent, ['Competitor Corp']);
      
      matches.forEach(match => {
        expect(match.matchConfidence).toBeGreaterThanOrEqual(0.5);
        expect(match.matchConfidence).toBeLessThanOrEqual(1.0);
      });
    });

    it('should handle special characters in competitor names', async () => {
      const event: EventData = {
        ...mockEvent,
        speakers: [
          { name: 'John', org: 'Competitor & Co.', title: 'CTO' }
        ]
      };
      
      const matches = await detectCompetitorsInEvent(event, ['Competitor & Co']);
      
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('generateCompetitiveAlerts', () => {
    const mockContext: CompetitiveContext = {
      competitorsPresent: [
        {
          competitorName: 'Competitor Corp',
          matchType: 'sponsor',
          matchConfidence: 0.9,
          matchDetails: {
            eventId: 'test-event-1',
            eventTitle: 'Tech Conference 2024',
            eventDate: '2024-06-15T10:00:00Z',
            role: 'Gold Sponsor',
            organization: 'Competitor Corp'
          }
        }
      ],
      competitorCount: 1,
      highValueCompetitors: ['Competitor Corp'],
      competitiveGaps: [
        {
          competitorName: 'Competitor Corp',
          eventsAttending: ['event-1', 'event-2', 'event-3'],
          eventsUserNotAttending: ['event-2', 'event-3']
        }
      ],
      activityComparison: [
        {
          competitorName: 'Competitor Corp',
          userEventCount: 5,
          competitorEventCount: 10,
          growthRate: 50,
          gapCount: 5
        }
      ]
    };

    const mockIntelligence = {
      opportunityScore: {
        overallScore: 0.8
      }
    };

    it('should generate high-value event alerts', () => {
      const alerts = generateCompetitiveAlerts(mockContext, mockIntelligence, mockEvent);
      
      const highValueAlerts = alerts.filter(a => a.type === 'high_value_event');
      expect(highValueAlerts.length).toBeGreaterThan(0);
      expect(highValueAlerts[0].severity).toBe('high');
    });

    it('should generate activity spike alerts', () => {
      // Activity spike requires: growthRate > 50 AND competitorEventCount > 5
      const spikeContext: CompetitiveContext = {
        ...mockContext,
        activityComparison: [
          {
            competitorName: 'Competitor Corp',
            userEventCount: 5,
            competitorEventCount: 10, // > 5
            growthRate: 60, // > 50
            gapCount: 5
          }
        ]
      };
      
      const alerts = generateCompetitiveAlerts(spikeContext, mockIntelligence, mockEvent);
      
      const spikeAlerts = alerts.filter(a => a.type === 'activity_spike');
      expect(spikeAlerts.length).toBeGreaterThan(0);
    });

    it('should generate competitive gap alerts', () => {
      // Gap alerts require: eventsUserNotAttending.length >= 3
      const gapContext: CompetitiveContext = {
        ...mockContext,
        competitiveGaps: [
          {
            competitorName: 'Competitor Corp',
            eventsAttending: ['event-1', 'event-2', 'event-3', 'event-4'],
            eventsUserNotAttending: ['event-2', 'event-3', 'event-4'] // >= 3
          }
        ]
      };
      
      const alerts = generateCompetitiveAlerts(gapContext, mockIntelligence, mockEvent);
      
      const gapAlerts = alerts.filter(a => a.type === 'competitive_gap');
      expect(gapAlerts.length).toBeGreaterThan(0);
      expect(gapAlerts[0].severity).toBe('high');
    });

    it('should not generate alerts when opportunity score is low', () => {
      const lowScoreIntelligence = {
        opportunityScore: {
          overallScore: 0.3
        }
      };
      
      const alerts = generateCompetitiveAlerts(mockContext, lowScoreIntelligence, mockEvent);
      
      const highValueAlerts = alerts.filter(a => a.type === 'high_value_event');
      expect(highValueAlerts.length).toBe(0);
    });

    it('should not generate activity spike alerts when growth is low', () => {
      const lowGrowthContext: CompetitiveContext = {
        ...mockContext,
        activityComparison: [
          {
            competitorName: 'Competitor Corp',
            userEventCount: 5,
            competitorEventCount: 6,
            growthRate: 10, // Low growth
            gapCount: 1
          }
        ]
      };
      
      const alerts = generateCompetitiveAlerts(lowGrowthContext, mockIntelligence, mockEvent);
      
      const spikeAlerts = alerts.filter(a => a.type === 'activity_spike');
      expect(spikeAlerts.length).toBe(0);
    });

    it('should not generate gap alerts when gap is small', () => {
      const smallGapContext: CompetitiveContext = {
        ...mockContext,
        competitiveGaps: [
          {
            competitorName: 'Competitor Corp',
            eventsAttending: ['event-1', 'event-2'],
            eventsUserNotAttending: ['event-2'] // Only 1 gap
          }
        ]
      };
      
      const alerts = generateCompetitiveAlerts(smallGapContext, mockIntelligence, mockEvent);
      
      const gapAlerts = alerts.filter(a => a.type === 'competitive_gap');
      expect(gapAlerts.length).toBe(0);
    });

    it('should include recommended actions in alerts', () => {
      const alerts = generateCompetitiveAlerts(mockContext, mockIntelligence, mockEvent);
      
      alerts.forEach(alert => {
        expect(alert.recommendedAction).toBeTruthy();
        expect(alert.recommendedAction.length).toBeGreaterThan(0);
      });
    });

    it('should assign correct severity levels', () => {
      const alerts = generateCompetitiveAlerts(mockContext, mockIntelligence, mockEvent);
      
      alerts.forEach(alert => {
        expect(['high', 'medium', 'low']).toContain(alert.severity);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined event data gracefully', async () => {
      const nullEvent = null as any;
      const matches = await detectCompetitorsInEvent(nullEvent, mockCompetitors);
      
      expect(matches).toEqual([]);
    });

    it('should handle events with missing fields', async () => {
      const partialEvent: EventData = {
        id: 'partial',
        source_url: 'https://example.com/partial',
        title: 'Partial Event'
        // Missing speakers, sponsors, etc.
      };
      
      const matches = await detectCompetitorsInEvent(partialEvent, mockCompetitors);
      
      expect(Array.isArray(matches)).toBe(true);
    });

    it('should handle very long competitor names', async () => {
      const longName = 'A'.repeat(200);
      const event: EventData = {
        ...mockEvent,
        speakers: [
          { name: 'John', org: longName, title: 'CTO' }
        ]
      };
      
      const matches = await detectCompetitorsInEvent(event, [longName]);
      
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters in competitor names', async () => {
      const unicodeName = 'Competitor Café & Co.™';
      const event: EventData = {
        ...mockEvent,
        speakers: [
          { name: 'John', org: unicodeName, title: 'CTO' }
        ]
      };
      
      const matches = await detectCompetitorsInEvent(event, [unicodeName]);
      
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});

