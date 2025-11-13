/**
 * PHASE 2 OPTIMIZATION: Speaker Service
 * 
 * Manages speaker event history and cross-event speaker queries.
 * Enables:
 * - Linking speakers to events
 * - Retrieving speaker history across events
 * - Enriching speakers with event history
 * - Generating canonical speaker keys for fuzzy matching
 */

import { supabaseServer } from '@/lib/supabase-server';
import { normalizeOrg } from '@/lib/utils/org-normalizer';
import crypto from 'crypto';

export interface SpeakerHistoryEntry {
  id: string;
  speaker_key: string;
  speaker_name: string;
  speaker_org: string | null;
  speaker_title: string | null;
  event_id: string;
  talk_title: string | null;
  session_name: string | null;
  speech_title: string | null;
  appeared_at: string;
  confidence: number | null;
}

export interface SpeakerHistory {
  speaker_key: string;
  speaker_name: string;
  speaker_org: string | null;
  totalAppearances: number;
  recentEvents: Array<{
    event_id: string;
    event_title: string;
    event_date: string | null;
    talk_title: string | null;
    session: string | null;
    appeared_at: string;
  }>;
  talkThemes: string[];
  firstSeen: string;
  lastSeen: string;
}

export interface SpeakerInfo {
  name: string;
  org?: string;
  title?: string;
}

/**
 * Generate canonical speaker key for fuzzy matching
 * Format: hash(normalizedName + normalizedOrg)
 */
export function generateSpeakerKey(speaker: SpeakerInfo): string {
  const normalizedName = speaker.name
    .toLowerCase()
    .trim()
    .replace(/^(dr\.?|prof\.?|professor|mr\.?|mrs\.?|ms\.?|miss)\s+/i, '')
    .replace(/\b([A-Z])\.\s+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const normalizedOrg = speaker.org 
    ? normalizeOrg(speaker.org).toLowerCase().trim()
    : '';
  
  const keyString = `${normalizedName}|${normalizedOrg}`;
  return crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 16);
}

/**
 * Link a speaker to an event in the history table
 * 
 * @param speaker Speaker information
 * @param eventId Event ID from collected_events table
 * @param context Optional context (talk title, session, etc.)
 * @param confidence Confidence score (0-1)
 * @returns Created or updated history entry
 */
export async function linkSpeakerToEvent(
  speaker: SpeakerInfo,
  eventId: string,
  context?: {
    talk_title?: string | null;
    session_name?: string | null;
    speech_title?: string | null;
  },
  confidence?: number | null
): Promise<SpeakerHistoryEntry | null> {
  try {
    const supabase = supabaseServer();
    const speakerKey = generateSpeakerKey(speaker);
    
    const historyData = {
      speaker_key: speakerKey,
      speaker_name: speaker.name,
      speaker_org: speaker.org || null,
      speaker_title: speaker.title || null,
      event_id: eventId,
      talk_title: context?.talk_title || context?.speech_title || null,
      session_name: context?.session_name || null,
      speech_title: context?.speech_title || context?.talk_title || null,
      confidence: confidence || null,
    };
    
    // Upsert (insert or update on conflict)
    const { data, error } = await supabase
      .from('speaker_event_history')
      .upsert(historyData, {
        onConflict: 'speaker_key,event_id',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (error) {
      console.error('[speaker-service] Error linking speaker to event:', error);
      return null;
    }
    
    return data as SpeakerHistoryEntry;
  } catch (error) {
    console.error('[speaker-service] Exception linking speaker to event:', error);
    return null;
  }
}

/**
 * Get speaker history across all events
 * 
 * @param speakerKey Canonical speaker key
 * @param limit Maximum number of recent events to return
 * @returns Speaker history with event details
 */
export async function getSpeakerHistory(
  speakerKey: string,
  limit: number = 10
): Promise<SpeakerHistory | null> {
  try {
    const supabase = supabaseServer();
    
    // Get all history entries for this speaker
    const { data: historyEntries, error: historyError } = await supabase
      .from('speaker_event_history')
      .select('*')
      .eq('speaker_key', speakerKey)
      .order('appeared_at', { ascending: false })
      .limit(limit);
    
    if (historyError) {
      console.error('[speaker-service] Error fetching speaker history:', historyError);
      return null;
    }
    
    if (!historyEntries || historyEntries.length === 0) {
      return null;
    }
    
    // Get event details for each history entry
    const eventIds = historyEntries.map(entry => entry.event_id);
    const { data: events, error: eventsError } = await supabase
      .from('collected_events')
      .select('id, title, starts_at')
      .in('id', eventIds);
    
    if (eventsError) {
      console.error('[speaker-service] Error fetching event details:', eventsError);
      return null;
    }
    
    // Create event map for quick lookup
    const eventMap = new Map(
      (events || []).map(event => [event.id, event])
    );
    
    // Build recent events array
    const recentEvents = historyEntries
      .map(entry => {
        const event = eventMap.get(entry.event_id);
        return {
          event_id: entry.event_id,
          event_title: event?.title || 'Unknown Event',
          event_date: event?.starts_at || null,
          talk_title: entry.talk_title || entry.speech_title || null,
          session: entry.session_name || null,
          appeared_at: entry.appeared_at,
        };
      })
      .filter(e => e.event_title !== 'Unknown Event');
    
    // Extract talk themes (non-null talk titles)
    const talkThemes = historyEntries
      .map(entry => entry.talk_title || entry.speech_title)
      .filter((title): title is string => title !== null && title.length > 0);
    
    // Get first and last appearance dates
    const dates = historyEntries.map(e => new Date(e.appeared_at)).sort((a, b) => a.getTime() - b.getTime());
    const firstSeen = dates[0]?.toISOString() || historyEntries[historyEntries.length - 1]?.appeared_at || '';
    const lastSeen = dates[dates.length - 1]?.toISOString() || historyEntries[0]?.appeared_at || '';
    
    const firstEntry = historyEntries[historyEntries.length - 1]; // Oldest (last in desc order)
    
    return {
      speaker_key: speakerKey,
      speaker_name: firstEntry.speaker_name,
      speaker_org: firstEntry.speaker_org,
      totalAppearances: historyEntries.length,
      recentEvents,
      talkThemes: Array.from(new Set(talkThemes)), // Remove duplicates
      firstSeen,
      lastSeen,
    };
  } catch (error) {
    console.error('[speaker-service] Exception fetching speaker history:', error);
    return null;
  }
}

/**
 * Enrich a speaker object with event history
 * 
 * @param speaker Speaker information
 * @param limit Maximum number of recent events to include
 * @returns Speaker object with history attached
 */
export async function enrichSpeakerWithHistory(
  speaker: SpeakerInfo,
  limit: number = 5
): Promise<SpeakerInfo & { history?: SpeakerHistory }> {
  const speakerKey = generateSpeakerKey(speaker);
  const history = await getSpeakerHistory(speakerKey, limit);
  
  return {
    ...speaker,
    ...(history && { history }),
  };
}

/**
 * Get all speakers for a specific event
 * 
 * @param eventId Event ID
 * @returns Array of speaker history entries
 */
export async function getEventSpeakers(eventId: string): Promise<SpeakerHistoryEntry[]> {
  try {
    const supabase = supabaseServer();
    
    const { data, error } = await supabase
      .from('speaker_event_history')
      .select('*')
      .eq('event_id', eventId)
      .order('appeared_at', { ascending: false });
    
    if (error) {
      console.error('[speaker-service] Error fetching event speakers:', error);
      return [];
    }
    
    return (data || []) as SpeakerHistoryEntry[];
  } catch (error) {
    console.error('[speaker-service] Exception fetching event speakers:', error);
    return [];
  }
}

/**
 * Find speakers by name (fuzzy matching via speaker_key generation)
 * Note: This is a simple implementation. For true fuzzy matching,
 * use the fuzzy matching logic from extract.ts
 * 
 * @param name Speaker name
 * @param org Optional organization
 * @returns Array of matching speaker keys
 */
export async function findSpeakersByName(
  name: string,
  org?: string
): Promise<string[]> {
  try {
    const supabase = supabaseServer();
    
    // Generate key for the search term
    const searchKey = generateSpeakerKey({ name, org });
    
    // Find speakers with similar keys (exact match for now)
    // For true fuzzy matching, we'd need to query all speakers and filter
    const { data, error } = await supabase
      .from('speaker_event_history')
      .select('speaker_key')
      .eq('speaker_key', searchKey)
      .limit(1);
    
    if (error) {
      console.error('[speaker-service] Error finding speakers:', error);
      return [];
    }
    
    return data ? Array.from(new Set(data.map(d => d.speaker_key))) : [];
  } catch (error) {
    console.error('[speaker-service] Exception finding speakers:', error);
    return [];
  }
}

