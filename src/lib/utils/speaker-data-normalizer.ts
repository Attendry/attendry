/**
 * Speaker Data Normalizer
 * 
 * Utility functions to normalize and clean speaker data from various sources
 * to ensure consistent display of title and organization information.
 */

import { SpeakerData } from '@/lib/types/core';

/**
 * Normalize speaker data from various extraction sources
 */
export function normalizeSpeakerData(rawSpeaker: any): SpeakerData {
  if (!rawSpeaker || typeof rawSpeaker !== 'object') {
    return { name: 'Unknown Speaker' };
  }

  // Extract name from various possible fields
  const name = extractStringValue(rawSpeaker, [
    'name', 'full_name', 'fullName', 'speaker_name', 'speakerName'
  ]);

  // Extract organization from various possible fields
  const org = extractStringValue(rawSpeaker, [
    'org', 'organization', 'company', 'employer', 'employer_name', 
    'employerName', 'firm', 'law_firm', 'lawFirm', 'practice',
    'institution', 'affiliation', 'organization_name', 'organizationName'
  ]);

  // Extract title from various possible fields
  const title = extractStringValue(rawSpeaker, [
    'title', 'job_title', 'jobTitle', 'position', 'role', 'job',
    'profession', 'designation', 'role_title', 'roleTitle'
  ]);

  // Extract other fields
  const profile_url = extractStringValue(rawSpeaker, [
    'profile_url', 'profileUrl', 'url', 'linkedin_url', 'linkedinUrl',
    'personal_url', 'personalUrl', 'website', 'homepage'
  ]);

  const source_url = extractStringValue(rawSpeaker, [
    'source_url', 'sourceUrl', 'event_url', 'eventUrl', 'page_url', 'pageUrl'
  ]);

  const session = extractStringValue(rawSpeaker, [
    'session', 'session_title', 'sessionTitle', 'track', 'session_name', 'sessionName'
  ]);

  const speech_title = extractStringValue(rawSpeaker, [
    'speech_title', 'speechTitle', 'presentation_title', 'presentationTitle',
    'talk_title', 'talkTitle', 'presentation', 'talk'
  ]);

  const bio = extractStringValue(rawSpeaker, [
    'bio', 'biography', 'description', 'summary', 'about', 'background'
  ]);

  const linkedin_url = extractStringValue(rawSpeaker, [
    'linkedin_url', 'linkedinUrl', 'linkedin', 'linkedin_profile', 'linkedinProfile'
  ]);

  const twitter_url = extractStringValue(rawSpeaker, [
    'twitter_url', 'twitterUrl', 'twitter', 'twitter_profile', 'twitterProfile'
  ]);

  const email = extractStringValue(rawSpeaker, [
    'email', 'email_address', 'emailAddress', 'contact_email', 'contactEmail'
  ]);

  const confidence = typeof rawSpeaker.confidence === 'number' 
    ? rawSpeaker.confidence 
    : calculateConfidenceFromData(name, org, title);

  return {
    name: name || 'Unknown Speaker',
    org: org || undefined,
    title: title || undefined,
    profile_url: profile_url || undefined,
    source_url: source_url || undefined,
    session: session || undefined,
    speech_title: speech_title || undefined,
    bio: bio || undefined,
    linkedin_url: linkedin_url || undefined,
    twitter_url: twitter_url || undefined,
    email: email || undefined,
    confidence: confidence
  };
}

/**
 * Extract string value from object using multiple possible field names
 */
function extractStringValue(obj: any, fieldNames: string[]): string | undefined {
  for (const fieldName of fieldNames) {
    const value = obj[fieldName];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Calculate confidence score based on available data
 */
function calculateConfidenceFromData(name?: string, org?: string, title?: string): number {
  let confidence = 0.5; // Base confidence

  if (name && name !== 'Unknown Speaker') {
    confidence += 0.3;
  }

  if (org) {
    confidence += 0.1;
  }

  if (title) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Check if speaker has basic information (name, title, or org)
 */
export function hasBasicSpeakerInfo(speaker: SpeakerData): boolean {
  return !!(speaker.name && speaker.name !== 'Unknown Speaker') &&
         (!!speaker.title || !!speaker.org);
}

/**
 * Get display title for speaker (enhanced or basic)
 */
export function getDisplayTitle(speaker: SpeakerData, enhancedSpeaker?: any): string | undefined {
  return enhancedSpeaker?.title || speaker.title;
}

/**
 * Get display organization for speaker (enhanced or basic)
 */
export function getDisplayOrganization(speaker: SpeakerData, enhancedSpeaker?: any): string | undefined {
  return enhancedSpeaker?.organization || speaker.org;
}

/**
 * Create a unique key for speaker caching
 * Includes multiple identifying fields to ensure uniqueness
 */
export function createSpeakerKey(speaker: SpeakerData): string {
  const name = speaker.name?.toLowerCase().trim() || '';
  const org = speaker.org?.toLowerCase().trim() || '';
  const title = speaker.title?.toLowerCase().trim() || '';
  const profileUrl = speaker.profile_url?.toLowerCase().trim() || '';
  const sourceUrl = speaker.source_url?.toLowerCase().trim() || '';
  const session = speaker.session?.toLowerCase().trim() || '';
  const speechTitle = speaker.speech_title?.toLowerCase().trim() || '';
  
  // Create a more unique key by including multiple identifying fields
  // This prevents different speakers from sharing the same cache entry
  const keyParts = [name, org, title, profileUrl, sourceUrl, session, speechTitle].filter(Boolean);
  return keyParts.join('|');
}
