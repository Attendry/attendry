/**
 * Competitor Discovery Service
 * 
 * Enhancement 4: Automated Competitor Discovery
 * Automatically identifies and suggests competitors based on user activity
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { UserProfile } from '@/lib/types/core';
import { findCompetitorEvents } from './competitive-intelligence-service';

export interface CompetitorSuggestion {
  companyName: string;
  confidence: number; // 0-1
  reasons: string[];
  evidence: {
    sharedEvents: number;
    industryMatch: boolean;
    similarActivity: boolean;
    geographicOverlap: boolean;
  };
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Discover competitors based on user activity
 */
export async function discoverCompetitors(
  userId: string,
  userProfile: UserProfile
): Promise<CompetitorSuggestion[]> {
  const supabase = supabaseAdmin();
  
  // Get user's events
  const { data: userBoardItems } = await supabase
    .from('user_event_board')
    .select('event_id, event_data')
    .eq('user_id', userId);
  
  if (!userBoardItems || userBoardItems.length === 0) {
    return [];
  }
  
  // Extract event IDs
  const userEventIds = userBoardItems
    .map(item => item.event_id || (item.event_data as any)?.id || (item.event_data as any)?.source_url)
    .filter((id): id is string => id !== null);
  
  // Get all events user is attending
  const { data: userEvents } = await supabase
    .from('collected_events')
    .select('*')
    .in('id', userEventIds)
    .limit(100);
  
  if (!userEvents || userEvents.length === 0) {
    return [];
  }
  
  // Extract all companies from user's events
  const allCompanies = new Set<string>();
  
  for (const event of userEvents) {
    // Extract from speakers
    if (event.speakers && Array.isArray(event.speakers)) {
      event.speakers.forEach((speaker: any) => {
        if (speaker.org) {
          allCompanies.add(speaker.org);
        }
      });
    }
    
    // Extract from sponsors
    if (event.sponsors && Array.isArray(event.sponsors)) {
      event.sponsors.forEach((sponsor: any) => {
        const sponsorName = typeof sponsor === 'string' ? sponsor : sponsor.name;
        if (sponsorName) {
          allCompanies.add(sponsorName);
        }
      });
    }
    
    // Extract from participating organizations
    if (event.participating_organizations && Array.isArray(event.participating_organizations)) {
      event.participating_organizations.forEach((org: string) => {
        allCompanies.add(org);
      });
    }
  }
  
  // Filter out user's own company and existing competitors
  const userCompany = userProfile.company?.toLowerCase();
  const existingCompetitors = new Set(
    (userProfile.competitors || []).map(c => c.toLowerCase())
  );
  
  const candidateCompanies = Array.from(allCompanies).filter(company => {
    const normalized = company.toLowerCase();
    return normalized !== userCompany &&
           !existingCompetitors.has(normalized) &&
           company.length > 2; // Filter out very short names
  });
  
  // Calculate similarity scores for each candidate
  const suggestions: CompetitorSuggestion[] = [];
  
  // Get user's event set
  const userEventSet = new Set(userEventIds);
  
  for (const company of candidateCompanies) {
    // Find events where this company is present
    const companyEvents = await findCompetitorEvents(company);
    const companyEventIds = companyEvents
      .map(e => e.id || e.source_url)
      .filter((id): id is string => id !== null);
    const companyEventSet = new Set(companyEventIds);
    
    // Calculate shared events
    const sharedEvents = new Set([...userEventSet].filter(x => companyEventSet.has(x)));
    const sharedEventCount = sharedEvents.size;
    
    // Calculate Jaccard similarity
    const eventSimilarity = jaccardSimilarity(userEventSet, companyEventSet);
    
    // Check industry match (simplified - in production, use industry classification)
    const industryMatch = userProfile.industry_terms?.some(term =>
      company.toLowerCase().includes(term.toLowerCase())
    ) || false;
    
    // Calculate activity similarity (simplified)
    const userActivity = userEvents.length;
    const companyActivity = companyEvents.length;
    const activitySimilarity = Math.min(userActivity, companyActivity) / Math.max(userActivity, companyActivity, 1);
    
    // Calculate confidence score
    const confidence = (
      eventSimilarity * 0.4 + // Shared events weight
      (sharedEventCount > 0 ? 0.3 : 0) + // Shared event bonus
      (industryMatch ? 0.2 : 0) + // Industry match bonus
      activitySimilarity * 0.1 // Activity similarity
    );
    
    // Only suggest if confidence > 0.3
    if (confidence > 0.3) {
      const reasons: string[] = [];
      if (sharedEventCount > 0) {
        reasons.push(`Attends ${sharedEventCount} of the same events`);
      }
      if (industryMatch) {
        reasons.push('Same industry');
      }
      if (activitySimilarity > 0.5) {
        reasons.push('Similar event participation level');
      }
      
      suggestions.push({
        companyName: company,
        confidence,
        reasons,
        evidence: {
          sharedEvents: sharedEventCount,
          industryMatch,
          similarActivity: activitySimilarity > 0.5,
          geographicOverlap: false // Could be enhanced
        }
      });
    }
  }
  
  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 20); // Top 20
}

/**
 * Approve or reject a competitor suggestion
 */
export async function approveCompetitorSuggestion(
  userId: string,
  companyName: string,
  approved: boolean
): Promise<void> {
  if (!approved) return; // If rejected, just don't add
  
  const supabase = supabaseAdmin();
  
  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('competitors')
    .eq('id', userId)
    .single();
  
  if (!profile) return;
  
  // Add to competitors list
  const competitors = profile.competitors || [];
  if (!competitors.includes(companyName)) {
    competitors.push(companyName);
    
    await supabase
      .from('profiles')
      .update({ competitors })
      .eq('id', userId);
  }
}

