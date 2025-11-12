/**
 * Tests for speaker extraction and person validation
 */

import { describe, it, expect } from 'vitest';
import { 
  isLikelyPerson, 
  filterSpeakers, 
  isSpeakerSection,
  type RawSpeaker 
} from './speakers';

describe('isLikelyPerson', () => {
  describe('should accept valid person names', () => {
    it('accepts full German names', () => {
      const names = [
        'Dr. Andrea Müller',
        'Sebastian Koch',
        'Prof. Thomas Schmidt',
        'Christina Weber',
        'Michael von Braun',
        'Sarah-Maria Schneider',
        'Dr. Hans-Peter Friedrich'
      ];
      
      names.forEach(name => {
        const result = isLikelyPerson(name);
        expect(result.ok).toBe(true);
      });
    });
    
    it('accepts full English names', () => {
      const names = [
        'Dr. Sarah Johnson',
        'Michael Anderson',
        'Prof. James Wilson',
        'Jennifer Martinez',
        'David O\'Connor',
        'Mary-Ann Thompson'
      ];
      
      names.forEach(name => {
        const result = isLikelyPerson(name);
        expect(result.ok).toBe(true);
      });
    });
    
    it('accepts names with particles', () => {
      const names = [
        'Ludwig van Beethoven',
        'Alexander von Humboldt',
        'Leonardo da Vinci',
        'Jean de La Fontaine'
      ];
      
      names.forEach(name => {
        const result = isLikelyPerson(name);
        expect(result.ok).toBe(true);
      });
    });
    
    it('accepts names with honorifics', () => {
      const result1 = isLikelyPerson('Dr. Andreas Meyer', 'CEO', 'ACME GmbH');
      expect(result1.ok).toBe(true);
      
      const result2 = isLikelyPerson('Prof. Dr. Elisabeth Weber');
      expect(result2.ok).toBe(true);
      
      const result3 = isLikelyPerson('RA Thomas Müller');
      expect(result3.ok).toBe(true);
    });
  });
  
  describe('should reject non-person entities', () => {
    it('rejects event names', () => {
      const nonPersons = [
        'Privacy Summit',
        'User Summit',
        'Lawyers Forum',
        'Risk Summit',
        'Compliance Week',
        'Operations Summit',
        'National Privacy Symposium',
        'Data Protection Conference'
      ];
      
      nonPersons.forEach(name => {
        const result = isLikelyPerson(name);
        expect(result.ok).toBe(false);
        expect(result.reasons).toContain('non_person_keyword');
      });
    });
    
    it('rejects UI/CTA elements', () => {
      const uiElements = [
        'Reserve Seat',
        'Register Now',
        'Book Ticket',
        'Learn More',
        'Sign Up Today',
        'Contact Us'
      ];
      
      uiElements.forEach(name => {
        const result = isLikelyPerson(name);
        expect(result.ok).toBe(false);
        expect(result.reasons.some(r => r === 'ui_element')).toBe(true);
      });
    });
    
    it('rejects organization names', () => {
      const orgs = [
        'ACME Corp GmbH',
        'Microsoft Corporation',
        'Legal Services Ltd.',
        'Consulting AG'
      ];
      
      orgs.forEach(name => {
        const result = isLikelyPerson(name);
        expect(result.ok).toBe(false);
        expect(result.reasons).toContain('org_suffix_in_name');
      });
    });
    
    it('rejects organizational terms', () => {
      const terms = [
        'Resource Center',
        'Advisory Board',
        'Organizing Committee',
        'Day Instructor',
        'Faculty Team',
        'Program Committee'
      ];
      
      terms.forEach(name => {
        const result = isLikelyPerson(name);
        expect(result.ok).toBe(false);
      });
    });
    
    it('rejects single-word names without honorifics', () => {
      const result = isLikelyPerson('Speaker');
      expect(result.ok).toBe(false);
      expect(result.reasons).toContain('single_word_name');
    });
    
    it('rejects too-short names', () => {
      const result = isLikelyPerson('AB');
      expect(result.ok).toBe(false);
      expect(result.reasons).toContain('empty_or_short');
    });
    
    it('rejects too-long names', () => {
      const result = isLikelyPerson('This Is Obviously A Very Long Sentence Not A Person Name');
      expect(result.ok).toBe(false);
      expect(result.reasons).toContain('name_too_long');
    });
  });
  
  describe('edge cases', () => {
    it('handles empty names', () => {
      const result = isLikelyPerson('');
      expect(result.ok).toBe(false);
    });
    
    it('handles names with only whitespace', () => {
      const result = isLikelyPerson('   ');
      expect(result.ok).toBe(false);
    });
    
    it('considers org field as positive signal', () => {
      const result = isLikelyPerson('Anna Schmidt', 'CEO', 'Tech Company GmbH');
      expect(result.ok).toBe(true);
      expect(result.reasons).toContain('org_field_has_org_suffix');
    });
  });
});

describe('filterSpeakers', () => {
  it('filters out non-persons and keeps persons', () => {
    const raw: RawSpeaker[] = [
      { name: 'Dr. Thomas Weber', role: 'CEO', org: 'ACME GmbH' },
      { name: 'Privacy Summit', role: 'Event' },
      { name: 'Sarah Johnson', role: 'CTO' },
      { name: 'Reserve Seat' },
      { name: 'Michael Schmidt', role: 'Speaker' },
      { name: 'User Summit' },
      { name: 'Resource Center' }
    ];
    
    const filtered = filterSpeakers(raw);
    
    expect(filtered).toHaveLength(3);
    expect(filtered.map(s => s.name)).toEqual([
      'Dr. Thomas Weber',
      'Sarah Johnson',
      'Michael Schmidt'
    ]);
    expect(filtered.every(s => s.is_person)).toBe(true);
  });
  
  it('deduplicates by lowercase name', () => {
    const raw: RawSpeaker[] = [
      { name: 'Thomas Weber' },
      { name: 'thomas weber' },
      { name: 'THOMAS WEBER' },
      { name: 'Sarah Johnson' }
    ];
    
    const filtered = filterSpeakers(raw);
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(s => s.name)).toEqual([
      'Thomas Weber',
      'Sarah Johnson'
    ]);
  });
  
  it('preserves role, org, url fields', () => {
    const raw: RawSpeaker[] = [
      { 
        name: 'Dr. Andrea Müller',
        role: 'Chief Privacy Officer',
        org: 'ACME Corp',
        url: 'https://example.com/andrea'
      }
    ];
    
    const filtered = filterSpeakers(raw);
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].role).toBe('Chief Privacy Officer');
    expect(filtered[0].org).toBe('ACME Corp');
    expect(filtered[0].url).toBe('https://example.com/andrea');
  });
  
  it('returns empty array when all are non-persons', () => {
    const raw: RawSpeaker[] = [
      { name: 'Privacy Summit' },
      { name: 'User Forum' },
      { name: 'Reserve Seat' }
    ];
    
    const filtered = filterSpeakers(raw);
    
    expect(filtered).toHaveLength(0);
  });
  
  it('skips empty names', () => {
    const raw: RawSpeaker[] = [
      { name: '' },
      { name: '   ' },
      { name: 'Thomas Weber' }
    ];
    
    const filtered = filterSpeakers(raw);
    
    expect(filtered).toHaveLength(1);
  });
});

describe('isSpeakerSection', () => {
  it('identifies speaker section headings', () => {
    const headings = [
      'Speakers',
      'Our Speakers',
      'Meet the Speakers',
      'Referenten',
      'Unsere Referenten',
      'Lernen Sie die Referenten kennen',
      'Faculty',
      'Presenters',
      'Keynote Speakers',
      'About the Speakers'
    ];
    
    headings.forEach(heading => {
      expect(isSpeakerSection(heading)).toBe(true);
    });
  });
  
  it('rejects non-speaker headings', () => {
    const headings = [
      'Venue',
      'Location',
      'Register',
      'Tickets',
      'Sponsors',
      'Partners',
      'About',
      'Contact'
    ];
    
    headings.forEach(heading => {
      expect(isSpeakerSection(heading)).toBe(false);
    });
  });
  
  it('is case-insensitive', () => {
    expect(isSpeakerSection('SPEAKERS')).toBe(true);
    expect(isSpeakerSection('speakers')).toBe(true);
    expect(isSpeakerSection('SpEaKeRs')).toBe(true);
  });
});

