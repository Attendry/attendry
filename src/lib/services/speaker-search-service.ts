/**
 * Unified Speaker Search Service
 * Provides fuzzy matching and full-text search across all speaker tables
 */

import { supabaseServer } from '@/lib/supabase-server';
import { levenshteinSimilarity } from '@/lib/utils/levenshtein';
import { orgSimilarity, normalizeOrg } from '@/lib/utils/org-normalizer';
import { generateSpeakerKey } from './speaker-service';

export interface SpeakerSearchResult {
  id: string;
  speaker_key: string | null;
  name: string;
  org: string | null;
  title: string | null;
  source: 'event_history' | 'saved_profile' | 'enhanced_profile' | 'account_speaker';
  source_id: string;
  similarity: number; // 0-1 similarity score
  events?: Array<{
    event_id: string;
    event_title?: string;
    talk_title?: string | null;
    appeared_at: string;
  }>;
  metadata?: {
    bio?: string;
    email?: string;
    linkedin?: string;
    profile_url?: string;
    confidence?: number;
    tags?: string[];
  };
}

export interface SpeakerSearchOptions {
  query?: string; // Full-text search
  name?: string; // Name search (fuzzy)
  org?: string; // Organization filter
  title?: string; // Job title filter
  topic?: string; // Speaking topic filter
  eventId?: string; // Filter by event
  dateRange?: { from: string; to: string }; // Date range filter
  minConfidence?: number; // Confidence threshold
  limit?: number; // Result limit (default: 50)
  offset?: number; // Pagination offset
  userId?: string; // For user-specific tables
}

/**
 * Normalize name for fuzzy matching
 */
function normalizeNameForMatching(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(dr\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?|miss)\s+/i, '')
    .replace(/\b([A-Z])\.\s+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search speaker_event_history table
 */
async function searchEventHistory(
  options: SpeakerSearchOptions,
  userId?: string
): Promise<SpeakerSearchResult[]> {
  const supabase = await supabaseServer();
  const results: SpeakerSearchResult[] = [];

  let query = supabase
    .from('speaker_event_history')
    .select(`
      *,
      collected_events!inner(id, title, starts_at)
    `)
    .order('appeared_at', { ascending: false });

  // Full-text search
  if (options.query) {
    query = query.or(`speaker_name.ilike.%${options.query}%,speaker_org.ilike.%${options.query}%,speaker_title.ilike.%${options.query}%`);
  }

  // Name filter (exact match first, then fuzzy)
  if (options.name) {
    query = query.ilike('speaker_name', `%${options.name}%`);
  }

  // Org filter
  if (options.org) {
    query = query.ilike('speaker_org', `%${options.org}%`);
  }

  // Event filter
  if (options.eventId) {
    query = query.eq('event_id', options.eventId);
  }

  // Date range filter
  if (options.dateRange) {
    if (options.dateRange.from) {
      query = query.gte('appeared_at', options.dateRange.from);
    }
    if (options.dateRange.to) {
      query = query.lte('appeared_at', options.dateRange.to);
    }
  }

  // Confidence filter
  if (options.minConfidence !== undefined) {
    query = query.gte('confidence', options.minConfidence);
  }

  const limit = options.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('[speaker-search] Error searching event history:', error);
    return [];
  }

  if (!data) return [];

  // Calculate similarity scores if name search provided
  const searchName = options.name ? normalizeNameForMatching(options.name) : null;
  const searchOrg = options.org ? normalizeOrg(options.org).toLowerCase() : null;

  for (const row of data) {
    let similarity = 1.0; // Default for exact matches

    if (searchName) {
      const nameSim = levenshteinSimilarity(
        searchName,
        normalizeNameForMatching(row.speaker_name)
      );
      similarity = nameSim;

      // Boost similarity if org matches
      if (searchOrg && row.speaker_org) {
        const orgSim = orgSimilarity(searchOrg, row.speaker_org);
        similarity = (nameSim * 0.7) + (orgSim * 0.3); // Weighted combination
      }
    } else if (searchOrg && row.speaker_org) {
      const orgSim = orgSimilarity(searchOrg, row.speaker_org);
      similarity = orgSim;
    }

    // Filter by minimum similarity (if name/org search provided)
    if (searchName || searchOrg) {
      if (similarity < 0.6) continue; // Skip low similarity matches
    }

    // Handle event data (could be object or array)
    const eventData = (row as any).collected_events;
    const event = Array.isArray(eventData) 
      ? eventData[0] 
      : eventData;

    results.push({
      id: row.id,
      speaker_key: row.speaker_key,
      name: row.speaker_name,
      org: row.speaker_org,
      title: row.speaker_title,
      source: 'event_history',
      source_id: row.id,
      similarity,
      events: event ? [{
        event_id: row.event_id,
        event_title: event.title || undefined,
        talk_title: row.talk_title || row.speech_title,
        appeared_at: row.appeared_at,
      }] : [{
        event_id: row.event_id,
        talk_title: row.talk_title || row.speech_title,
        appeared_at: row.appeared_at,
      }],
      metadata: {
        confidence: row.confidence || undefined,
      },
    });
  }

  return results;
}

/**
 * Search saved_speaker_profiles table
 */
async function searchSavedProfiles(
  options: SpeakerSearchOptions,
  userId: string
): Promise<SpeakerSearchResult[]> {
  if (!userId) return [];

  const supabase = await supabaseServer();
  const results: SpeakerSearchResult[] = [];

  let query = supabase
    .from('saved_speaker_profiles')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null) // Exclude deleted contacts
    .order('saved_at', { ascending: false });

  // Full-text search on JSONB fields
  if (options.query) {
    // Use ILIKE on JSONB fields for basic search
    query = query.or(
      `speaker_data->>name.ilike.%${options.query}%,speaker_data->>org.ilike.%${options.query}%,enhanced_data->>bio.ilike.%${options.query}%`
    );
  }

  // Name filter
  if (options.name) {
    query = query.ilike('speaker_data->>name', `%${options.name}%`);
  }

  // Org filter
  if (options.org) {
    query = query.ilike('speaker_data->>org', `%${options.org}%`);
  }

  // Title filter
  if (options.title) {
    query = query.ilike('enhanced_data->>title', `%${options.title}%`);
  }

  const limit = options.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('[speaker-search] Error searching saved profiles:', error);
    return [];
  }

  if (!data) return [];

  // Calculate similarity scores
  const searchName = options.name ? normalizeNameForMatching(options.name) : null;
  const searchOrg = options.org ? normalizeOrg(options.org).toLowerCase() : null;

  for (const row of data) {
    const speakerName = row.speaker_data?.name || '';
    const speakerOrg = row.speaker_data?.org || '';
    let similarity = 1.0;

    if (searchName) {
      const nameSim = levenshteinSimilarity(
        searchName,
        normalizeNameForMatching(speakerName)
      );
      similarity = nameSim;

      if (searchOrg && speakerOrg) {
        const orgSim = orgSimilarity(searchOrg, speakerOrg);
        similarity = (nameSim * 0.7) + (orgSim * 0.3);
      }
    } else if (searchOrg && speakerOrg) {
      const orgSim = orgSimilarity(searchOrg, speakerOrg);
      similarity = orgSim;
    }

    if (searchName || searchOrg) {
      if (similarity < 0.6) continue;
    }

    results.push({
      id: row.id,
      speaker_key: null, // Saved profiles don't have speaker_key
      name: speakerName,
      org: speakerOrg,
      title: row.speaker_data?.title || row.enhanced_data?.title || null,
      source: 'saved_profile',
      source_id: row.id,
      similarity,
      metadata: {
        bio: row.enhanced_data?.bio || row.speaker_data?.bio,
        email: row.speaker_data?.email,
        linkedin: row.speaker_data?.linkedin || row.speaker_data?.linkedin_url,
        profile_url: row.speaker_data?.profile_url,
        tags: row.tags || undefined,
      },
    });
  }

  return results;
}

/**
 * Search enhanced_speaker_profiles table
 */
async function searchEnhancedProfiles(
  options: SpeakerSearchOptions,
  userId: string
): Promise<SpeakerSearchResult[]> {
  if (!userId) return [];

  const supabase = await supabaseServer();
  const results: SpeakerSearchResult[] = [];

  let query = supabase
    .from('enhanced_speaker_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('last_enhanced_at', { ascending: false });

  // Full-text search
  if (options.query) {
    query = query.or(`speaker_name.ilike.%${options.query}%,speaker_org.ilike.%${options.query}%,speaker_title.ilike.%${options.query}%`);
  }

  // Name filter
  if (options.name) {
    query = query.ilike('speaker_name', `%${options.name}%`);
  }

  // Org filter
  if (options.org) {
    query = query.ilike('speaker_org', `%${options.org}%`);
  }

  // Title filter
  if (options.title) {
    query = query.ilike('speaker_title', `%${options.title}%`);
  }

  const limit = options.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('[speaker-search] Error searching enhanced profiles:', error);
    return [];
  }

  if (!data) return [];

  // Calculate similarity scores
  const searchName = options.name ? normalizeNameForMatching(options.name) : null;
  const searchOrg = options.org ? normalizeOrg(options.org).toLowerCase() : null;

  for (const row of data) {
    let similarity = 1.0;

    if (searchName) {
      const nameSim = levenshteinSimilarity(
        searchName,
        normalizeNameForMatching(row.speaker_name)
      );
      similarity = nameSim;

      if (searchOrg && row.speaker_org) {
        const orgSim = orgSimilarity(searchOrg, row.speaker_org);
        similarity = (nameSim * 0.7) + (orgSim * 0.3);
      }
    } else if (searchOrg && row.speaker_org) {
      const orgSim = orgSimilarity(searchOrg, row.speaker_org);
      similarity = orgSim;
    }

    if (searchName || searchOrg) {
      if (similarity < 0.6) continue;
    }

    results.push({
      id: row.id,
      speaker_key: row.speaker_key,
      name: row.speaker_name,
      org: row.speaker_org,
      title: row.speaker_title,
      source: 'enhanced_profile',
      source_id: row.id,
      similarity,
      metadata: {
        bio: row.enhanced_data?.bio,
        profile_url: row.profile_url || undefined,
        confidence: row.confidence || undefined,
      },
    });
  }

  return results;
}

/**
 * Search account_speakers table
 */
async function searchAccountSpeakers(
  options: SpeakerSearchOptions,
  userId: string
): Promise<SpeakerSearchResult[]> {
  if (!userId) return [];

  const supabase = await supabaseServer();
  const results: SpeakerSearchResult[] = [];

  // First, get user's account IDs
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id')
    .eq('created_by', userId);

  if (accountsError || !accounts || accounts.length === 0) {
    return [];
  }

  const accountIds = accounts.map(a => a.id);

  let query = supabase
    .from('account_speakers')
    .select('*')
    .in('account_id', accountIds)
    .order('created_at', { ascending: false });

  // Full-text search
  if (options.query) {
    query = query.or(`speaker_name.ilike.%${options.query}%,speaker_org.ilike.%${options.query}%,speaker_title.ilike.%${options.query}%`);
  }

  // Name filter
  if (options.name) {
    query = query.ilike('speaker_name', `%${options.name}%`);
  }

  // Company filter (org)
  if (options.org) {
    query = query.ilike('speaker_company', `%${options.org}%`);
  }

  // Title filter
  if (options.title) {
    query = query.ilike('speaker_title', `%${options.title}%`);
  }

  const limit = options.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('[speaker-search] Error searching account speakers:', error);
    return [];
  }

  if (!data) return [];

  // Calculate similarity scores
  const searchName = options.name ? normalizeNameForMatching(options.name) : null;
  const searchOrg = options.org ? normalizeOrg(options.org).toLowerCase() : null;

  for (const row of data) {
    let similarity = 1.0;

    if (searchName) {
      const nameSim = levenshteinSimilarity(
        searchName,
        normalizeNameForMatching(row.speaker_name)
      );
      similarity = nameSim;

      if (searchOrg && row.speaker_company) {
        const orgSim = orgSimilarity(searchOrg, row.speaker_company);
        similarity = (nameSim * 0.7) + (orgSim * 0.3);
      }
    } else if (searchOrg && row.speaker_company) {
      const orgSim = orgSimilarity(searchOrg, row.speaker_company);
      similarity = orgSim;
    }

    if (searchName || searchOrg) {
      if (similarity < 0.6) continue;
    }

    results.push({
      id: row.id,
      speaker_key: null,
      name: row.speaker_name,
      org: row.speaker_company,
      title: row.speaker_title,
      source: 'account_speaker',
      source_id: row.id,
      similarity,
      metadata: {
        bio: row.bio || undefined,
        email: row.email || undefined,
        linkedin: row.linkedin_url || undefined,
      },
    });
  }

  return results;
}

/**
 * Merge and deduplicate search results
 */
function mergeSearchResults(
  results: SpeakerSearchResult[]
): SpeakerSearchResult[] {
  // Group by speaker_key or name+org combination
  const grouped = new Map<string, SpeakerSearchResult>();

  for (const result of results) {
    const key = result.speaker_key || 
                `${normalizeNameForMatching(result.name)}|${result.org ? normalizeOrg(result.org).toLowerCase() : ''}`;
    
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, result);
    } else {
      // Merge: keep highest similarity, combine events, merge metadata
      if (result.similarity > existing.similarity) {
        existing.similarity = result.similarity;
      }

      // Merge events (avoid duplicates)
      if (result.events && result.events.length > 0) {
        if (!existing.events) existing.events = [];
        const existingEventIds = new Set(existing.events.map(e => e.event_id));
        for (const event of result.events) {
          if (!existingEventIds.has(event.event_id)) {
            existing.events.push(event);
          }
        }
      }

      // Merge metadata (prefer non-null values)
      if (result.metadata) {
        if (!existing.metadata) existing.metadata = {};
        Object.assign(existing.metadata, result.metadata);
      }
    }
  }

  return Array.from(grouped.values());
}

/**
 * Main unified search function
 */
export async function searchSpeakers(
  options: SpeakerSearchOptions
): Promise<{
  results: SpeakerSearchResult[];
  total: number;
  limit: number;
  offset: number;
}> {
  const { userId } = options;
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  // Search all tables in parallel
  const [eventHistory, savedProfiles, enhancedProfiles, accountSpeakers] = await Promise.all([
    searchEventHistory(options, userId),
    userId ? searchSavedProfiles(options, userId) : Promise.resolve([]),
    userId ? searchEnhancedProfiles(options, userId) : Promise.resolve([]),
    userId ? searchAccountSpeakers(options, userId) : Promise.resolve([]),
  ]);

  // Merge all results
  const allResults = [...eventHistory, ...savedProfiles, ...enhancedProfiles, ...accountSpeakers];

  // Deduplicate and merge
  const merged = mergeSearchResults(allResults);

  // Sort by similarity (descending)
  merged.sort((a, b) => b.similarity - a.similarity);

  // Apply pagination
  const total = merged.length;
  const paginated = merged.slice(offset, offset + limit);

  return {
    results: paginated,
    total,
    limit,
    offset,
  };
}

/**
 * Get speaker history by speaker_key
 */
export async function getSpeakerHistory(
  speakerKey: string,
  limit: number = 10
): Promise<SpeakerSearchResult['events']> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('speaker_event_history')
    .select(`
      *,
      collected_events!inner(id, title, starts_at)
    `)
    .eq('speaker_key', speakerKey)
    .order('appeared_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map(row => {
    const eventData = (row as any).collected_events;
    const event = Array.isArray(eventData) 
      ? eventData[0] 
      : eventData;

    return {
      event_id: row.event_id,
      event_title: event?.title || undefined,
      talk_title: row.talk_title || row.speech_title || null,
      appeared_at: row.appeared_at,
    };
  });
}

