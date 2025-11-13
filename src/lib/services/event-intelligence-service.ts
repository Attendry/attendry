/**
 * Event Intelligence Service
 * 
 * Generates and retrieves deep insights for specific events
 * Pre-computed and cached for fast retrieval
 */

import { EventData, UserProfile, SponsorData } from '@/lib/types/core';
import { LLMService } from './llm-service';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

export interface EventDiscussions {
  themes: string[];
  summary: string;
  keyTopics: Array<{ topic: string; importance: number }>;
  speakerInsights: string[];
}

export interface EventSponsors {
  analysis: string;
  tiers: Array<{ level: string; sponsors: SponsorData[] }>;
  industries: string[];
  strategicSignificance: number;
}

export interface EventLocation {
  venueContext: string;
  accessibility: string;
  localMarketInsights: string;
  travelRecommendations?: string;
}

export interface EventOutreach {
  positioning: string;
  recommendedApproach: string;
  keyContacts: Array<{ type: string; recommendation: string }>;
  timing: { recommendation: string; rationale: string };
  messaging: Array<{ angle: string; valueProposition: string }>;
}

export interface EventIntelligence {
  eventId: string;
  discussions: EventDiscussions;
  sponsors: EventSponsors;
  location: EventLocation;
  outreach: EventOutreach;
  confidence: number;
  generatedAt: string;
  cached: boolean;
  expiresAt?: string;
}

/**
 * Generate hash for user profile (for cache keys)
 */
function hashUserProfile(userProfile?: UserProfile): string {
  if (!userProfile) return 'general';
  
  const profileString = JSON.stringify({
    industry: userProfile.industry_terms?.sort() || [],
    icp: userProfile.icp_terms?.sort() || [],
    competitors: userProfile.competitors?.sort() || []
  });
  
  return crypto.createHash('sha256').update(profileString).digest('hex').substring(0, 16);
}

/**
 * Get event intelligence (check cache first, generate if missing)
 */
export async function getEventIntelligence(
  eventId: string,
  userProfile?: UserProfile
): Promise<EventIntelligence | null> {
  const supabase = supabaseAdmin();
  const profileHash = hashUserProfile(userProfile);
  
  // Check cache
  const { data: cached } = await supabase
    .from('event_intelligence')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_profile_hash', profileHash)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (cached) {
    return {
      eventId,
      discussions: cached.discussions || { themes: [], summary: '', keyTopics: [], speakerInsights: [] },
      sponsors: cached.sponsors || { analysis: '', tiers: [], industries: [], strategicSignificance: 0 },
      location: cached.location || { venueContext: '', accessibility: '', localMarketInsights: '' },
      outreach: cached.outreach || {
        positioning: '',
        recommendedApproach: '',
        keyContacts: [],
        timing: { recommendation: '', rationale: '' },
        messaging: []
      },
      confidence: cached.confidence || 0.7,
      generatedAt: cached.generated_at,
      cached: true,
      expiresAt: cached.expires_at
    };
  }
  
  return null;
}

/**
 * Analyze event discussions
 */
export async function analyzeEventDiscussions(
  event: EventData,
  options?: { provider?: 'gemini' | 'claude' }
): Promise<EventDiscussions> {
  const prompt = `Analyze the following event and extract discussion themes, key topics, and speaker insights.

Event Title: ${event.title}
Description: ${event.description || 'No description'}
Topics: ${(event.topics || []).join(', ')}
Speakers: ${event.speakers?.map(s => `${s.name}${s.org ? ` (${s.org})` : ''}${s.title ? ` - ${s.title}` : ''}`).join(', ') || 'No speakers listed'}

Return a JSON object with this structure:
{
  "themes": ["theme1", "theme2", ...],
  "summary": "Brief summary of main discussion themes",
  "keyTopics": [
    {"topic": "topic name", "importance": 0.0-1.0}
  ],
  "speakerInsights": ["insight1", "insight2", ...]
}

Focus on:
1. Main themes and topics being discussed
2. What makes this event unique or valuable
3. Insights from speaker lineup and their expertise
4. Industry trends reflected in the event

Return only the JSON object, no other text.`;

  try {
    const response = await LLMService.generateIntelligence(prompt, { event }, {
      provider: options?.provider || 'gemini'
    });
    
    if (typeof response.content === 'object' && response.content !== null) {
      return {
        themes: response.content.themes || [],
        summary: response.content.summary || '',
        keyTopics: response.content.keyTopics || [],
        speakerInsights: response.content.speakerInsights || []
      };
    }
    
    // Fallback
    return {
      themes: event.topics || [],
      summary: event.description?.substring(0, 200) || '',
      keyTopics: (event.topics || []).map(t => ({ topic: t, importance: 0.7 })),
      speakerInsights: event.speakers?.map(s => `${s.name} from ${s.org || 'unknown'}`) || []
    };
  } catch (error) {
    console.error('[EventIntelligence] Failed to analyze discussions:', error);
    // Fallback
    return {
      themes: event.topics || [],
      summary: event.description?.substring(0, 200) || '',
      keyTopics: (event.topics || []).map(t => ({ topic: t, importance: 0.7 })),
      speakerInsights: []
    };
  }
}

/**
 * Analyze event sponsors
 */
export async function analyzeSponsors(
  event: EventData,
  options?: { provider?: 'gemini' | 'claude' }
): Promise<EventSponsors> {
  const sponsors = event.sponsors || [];
  const sponsorList = sponsors.map(s => {
    if (typeof s === 'string') return s;
    return `${s.name}${s.level ? ` (${s.level})` : ''}`;
  }).join(', ');
  
  const prompt = `Analyze the sponsors of this event and provide strategic insights.

Event: ${event.title}
Sponsors: ${sponsorList || 'No sponsors listed'}
Organizer: ${event.organizer || 'Unknown'}

Return a JSON object with this structure:
{
  "analysis": "Strategic analysis of sponsor lineup",
  "tiers": [
    {
      "level": "Platinum/Gold/Silver/etc",
      "sponsors": [{"name": "...", "level": "...", ...}]
    }
  ],
  "industries": ["industry1", "industry2", ...],
  "strategicSignificance": 0.0-1.0
}

Focus on:
1. Sponsor tiers and levels
2. Industries represented
3. Strategic significance of sponsor lineup
4. What this tells us about the event's target audience

Return only the JSON object, no other text.`;

  try {
    const response = await LLMService.generateIntelligence(prompt, { event, sponsors }, {
      provider: options?.provider || 'gemini'
    });
    
    if (typeof response.content === 'object' && response.content !== null) {
      return {
        analysis: response.content.analysis || '',
        tiers: response.content.tiers || [],
        industries: response.content.industries || [],
        strategicSignificance: response.content.strategicSignificance || 0.5
      };
    }
    
    // Fallback
    const sponsorData: SponsorData[] = sponsors.map(s => {
      if (typeof s === 'string') return { name: s };
      return s;
    });
    
    return {
      analysis: `Event has ${sponsors.length} sponsor${sponsors.length !== 1 ? 's' : ''}`,
      tiers: [{ level: 'General', sponsors: sponsorData }],
      industries: [],
      strategicSignificance: sponsors.length > 0 ? 0.6 : 0.3
    };
  } catch (error) {
    console.error('[EventIntelligence] Failed to analyze sponsors:', error);
    // Fallback
    const sponsorData: SponsorData[] = sponsors.map(s => {
      if (typeof s === 'string') return { name: s };
      return s;
    });
    
    return {
      analysis: '',
      tiers: [{ level: 'General', sponsors: sponsorData }],
      industries: [],
      strategicSignificance: 0.5
    };
  }
}

/**
 * Analyze location context
 */
export async function analyzeLocationContext(
  event: EventData,
  options?: { provider?: 'gemini' | 'claude' }
): Promise<EventLocation> {
  const prompt = `Analyze the location and venue context for this event.

Event: ${event.title}
City: ${event.city || 'Unknown'}
Country: ${event.country || 'Unknown'}
Venue: ${event.venue || 'Unknown'}

Return a JSON object with this structure:
{
  "venueContext": "Context about the venue (prestige, type, capacity, etc.)",
  "accessibility": "Accessibility information (transport, parking, etc.)",
  "localMarketInsights": "Insights about the local market and business environment",
  "travelRecommendations": "Optional travel recommendations"
}

Focus on:
1. Venue characteristics and reputation
2. Accessibility and logistics
3. Local business market context
4. Travel considerations if relevant

Return only the JSON object, no other text.`;

  try {
    const response = await LLMService.generateIntelligence(prompt, { event }, {
      provider: options?.provider || 'gemini'
    });
    
    if (typeof response.content === 'object' && response.content !== null) {
      return {
        venueContext: response.content.venueContext || '',
        accessibility: response.content.accessibility || '',
        localMarketInsights: response.content.localMarketInsights || '',
        travelRecommendations: response.content.travelRecommendations
      };
    }
    
    // Fallback
    return {
      venueContext: event.venue || 'Venue information not available',
      accessibility: 'Check event website for accessibility information',
      localMarketInsights: `${event.city || ''} ${event.country || ''}`.trim() || 'Location information not available',
      travelRecommendations: undefined
    };
  } catch (error) {
    console.error('[EventIntelligence] Failed to analyze location:', error);
    // Fallback
    return {
      venueContext: event.venue || '',
      accessibility: '',
      localMarketInsights: '',
      travelRecommendations: undefined
    };
  }
}

/**
 * Generate outreach recommendations
 */
export async function generateOutreachRecommendations(
  event: EventData,
  userProfile?: UserProfile,
  options?: { provider?: 'gemini' | 'claude' }
): Promise<EventOutreach> {
  const userContext = userProfile ? {
    industry: userProfile.industry_terms || [],
    icp: userProfile.icp_terms || [],
    competitors: userProfile.competitors || []
  } : null;
  
  const prompt = `Generate outreach and positioning recommendations for this event.

Event: ${event.title}
Description: ${event.description || ''}
Topics: ${(event.topics || []).join(', ')}
Speakers: ${event.speakers?.map(s => `${s.name} (${s.org || 'unknown'})`).join(', ') || 'None'}
Sponsors: ${(event.sponsors || []).map(s => typeof s === 'string' ? s : s.name).join(', ') || 'None'}
Location: ${event.city || ''}, ${event.country || ''}
Date: ${event.starts_at || 'TBD'}

${userContext ? `User Context:
Industry: ${userContext.industry.join(', ')}
ICP: ${userContext.icp.join(', ')}
Competitors: ${userContext.competitors.join(', ')}` : 'No specific user context'}

Return a JSON object with this structure:
{
  "positioning": "How to position yourself/company at this event",
  "recommendedApproach": "Recommended outreach approach",
  "keyContacts": [
    {"type": "speaker/organizer/sponsor", "recommendation": "specific recommendation"}
  ],
  "timing": {
    "recommendation": "When to reach out",
    "rationale": "Why this timing"
  },
  "messaging": [
    {"angle": "messaging angle", "valueProposition": "value proposition"}
  ]
}

Focus on:
1. Strategic positioning opportunities
2. Key people to connect with (speakers, organizers, sponsors)
3. Optimal timing for outreach
4. Messaging angles that resonate with event themes

Return only the JSON object, no other text.`;

  try {
    const response = await LLMService.generateIntelligence(prompt, { event, userContext }, {
      provider: options?.provider || 'gemini'
    });
    
    if (typeof response.content === 'object' && response.content !== null) {
      return {
        positioning: response.content.positioning || '',
        recommendedApproach: response.content.recommendedApproach || '',
        keyContacts: response.content.keyContacts || [],
        timing: response.content.timing || { recommendation: '', rationale: '' },
        messaging: response.content.messaging || []
      };
    }
    
    // Fallback
    return {
      positioning: 'Position yourself as a thought leader in the event\'s main topics',
      recommendedApproach: 'Engage with speakers and attendees through networking sessions',
      keyContacts: [],
      timing: {
        recommendation: 'Reach out 2-4 weeks before the event',
        rationale: 'Allows time for meaningful connections before the event'
      },
      messaging: []
    };
  } catch (error) {
    console.error('[EventIntelligence] Failed to generate outreach:', error);
    // Fallback
    return {
      positioning: '',
      recommendedApproach: '',
      keyContacts: [],
      timing: { recommendation: '', rationale: '' },
      messaging: []
    };
  }
}

/**
 * Generate complete event intelligence
 */
export async function generateEventIntelligence(
  event: EventData,
  userProfile?: UserProfile,
  options?: { provider?: 'gemini' | 'claude' }
): Promise<EventIntelligence> {
  const startTime = Date.now();
  
  // Generate all intelligence components in parallel
  const [discussions, sponsors, location, outreach] = await Promise.all([
    analyzeEventDiscussions(event, options),
    analyzeSponsors(event, options),
    analyzeLocationContext(event, options),
    generateOutreachRecommendations(event, userProfile, options)
  ]);
  
  // Calculate confidence based on data completeness
  const hasDescription = !!event.description;
  const hasTopics = (event.topics || []).length > 0;
  const hasSpeakers = (event.speakers || []).length > 0;
  const hasSponsors = (event.sponsors || []).length > 0;
  const hasLocation = !!(event.city && event.country);
  
  const confidence = (
    (hasDescription ? 0.2 : 0) +
    (hasTopics ? 0.2 : 0) +
    (hasSpeakers ? 0.2 : 0) +
    (hasSponsors ? 0.2 : 0) +
    (hasLocation ? 0.2 : 0)
  );
  
  return {
    eventId: event.id || event.source_url,
    discussions,
    sponsors,
    location,
    outreach,
    confidence: Math.max(confidence, 0.5), // Minimum 0.5
    generatedAt: new Date().toISOString(),
    cached: false
  };
}

/**
 * Cache event intelligence
 */
export async function cacheEventIntelligence(
  eventId: string,
  intelligence: EventIntelligence,
  userProfile?: UserProfile,
  ttlHours: number = 24
): Promise<void> {
  const supabase = supabaseAdmin();
  const profileHash = hashUserProfile(userProfile);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  
  await supabase
    .from('event_intelligence')
    .upsert({
      event_id: eventId,
      user_profile_hash: profileHash,
      discussions: intelligence.discussions,
      sponsors: intelligence.sponsors,
      location: intelligence.location,
      outreach: intelligence.outreach,
      confidence: intelligence.confidence,
      generated_at: intelligence.generatedAt,
      expires_at: expiresAt.toISOString()
    }, {
      onConflict: 'event_id,user_profile_hash'
    });
}

/**
 * Pre-compute intelligence for an event (background job)
 */
export async function precomputeIntelligenceForEvent(
  event: EventData,
  userProfile?: UserProfile
): Promise<EventIntelligence> {
  const intelligence = await generateEventIntelligence(event, userProfile);
  const eventId = event.id || event.source_url;
  
  // Cache the result
  await cacheEventIntelligence(eventId, intelligence, userProfile);
  
  return intelligence;
}

