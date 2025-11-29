/**
 * Auto-Save Feedback Service
 * Handles notifications, badges, and undo functionality for auto-saved contacts
 */

import { supabaseServer } from '@/lib/supabase-server';

export interface AutoSaveEvent {
  id: string;
  user_id: string;
  event_id: string;
  speakers_saved: number;
  speakers_processed: number;
  status: 'processing' | 'completed' | 'failed' | 'partial';
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AutoSavedContact {
  id: string;
  speaker_data: any;
  enhanced_data: any;
  auto_saved_at: string;
  auto_save_event_id: string | null;
  auto_save_reasons: string[];
  can_undo_until: string | null;
}

/**
 * Create an auto-save event record
 */
export async function createAutoSaveEvent(
  userId: string,
  eventId: string,
  speakersProcessed: number = 0
): Promise<string | null> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .from('auto_save_events')
    .insert({
      user_id: userId,
      event_id: eventId,
      speakers_processed: speakersProcessed,
      status: 'processing',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating auto-save event:', error);
    return null;
  }

  return data.id;
}

/**
 * Update auto-save event with results
 */
export async function updateAutoSaveEvent(
  eventId: string,
  speakersSaved: number,
  status: 'completed' | 'failed' | 'partial' = 'completed',
  errorMessage?: string
): Promise<boolean> {
  const supabase = await supabaseServer();
  
  const { error } = await supabase
    .from('auto_save_events')
    .update({
      speakers_saved: speakersSaved,
      status,
      completed_at: new Date().toISOString(),
      error_message: errorMessage || null,
    })
    .eq('id', eventId);

  if (error) {
    console.error('Error updating auto-save event:', error);
    return false;
  }

  return true;
}

/**
 * Get auto-saved count for an event
 */
export async function getEventAutoSavedCount(
  eventId: string,
  userId: string
): Promise<number> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .rpc('get_event_auto_saved_count', {
      p_event_id: eventId,
      p_user_id: userId,
    });

  if (error) {
    console.error('Error getting auto-saved count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Get today's auto-saved contacts
 */
export async function getTodayAutoSavedContacts(
  userId: string
): Promise<AutoSavedContact[]> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .rpc('get_today_auto_saved_contacts', {
      p_user_id: userId,
    });

  if (error) {
    console.error('Error getting today\'s auto-saved contacts:', error);
    return [];
  }

  return (data || []).map((contact: any) => ({
    id: contact.id,
    speaker_data: contact.speaker_data,
    enhanced_data: contact.enhanced_data,
    auto_saved_at: contact.auto_saved_at,
    auto_save_event_id: contact.auto_save_event_id,
    auto_save_reasons: contact.auto_save_reasons || [],
    can_undo_until: contact.can_undo_until,
  }));
}

/**
 * Mark contact as auto-saved with metadata
 */
export async function markContactAsAutoSaved(
  contactId: string,
  eventId: string,
  reasons: string[] = []
): Promise<boolean> {
  const supabase = await supabaseServer();
  
  const now = new Date();
  const canUndoUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  const { error } = await supabase
    .from('saved_speaker_profiles')
    .update({
      auto_saved_at: now.toISOString(),
      auto_save_event_id: eventId,
      auto_save_reasons: reasons,
      can_undo_until: canUndoUntil.toISOString(),
      data_source: 'auto_save',
    })
    .eq('id', contactId);

  if (error) {
    console.error('Error marking contact as auto-saved:', error);
    return false;
  }

  return true;
}

/**
 * Undo auto-save (delete contact if within 24 hours)
 */
export async function undoAutoSave(
  contactId: string,
  userId: string
): Promise<boolean> {
  const supabase = await supabaseServer();
  
  // Check if contact exists and can be undone
  const { data: contact, error: fetchError } = await supabase
    .from('saved_speaker_profiles')
    .select('can_undo_until, auto_saved_at, undo_requested_at')
    .eq('id', contactId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !contact) {
    return false;
  }

  // Check if already undone
  if (contact.undo_requested_at) {
    return false;
  }

  // Check if undo window has expired
  if (contact.can_undo_until && new Date(contact.can_undo_until) < new Date()) {
    return false;
  }

  // Mark for undo (soft delete)
  const { error } = await supabase
    .from('saved_speaker_profiles')
    .update({
      undo_requested_at: new Date().toISOString(),
      deleted_at: new Date().toISOString(),
      deletion_reason: 'auto_save_undo',
    })
    .eq('id', contactId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error undoing auto-save:', error);
    return false;
  }

  return true;
}

/**
 * Get recent auto-save events for notifications
 */
export async function getRecentAutoSaveEvents(
  userId: string,
  limit: number = 10
): Promise<AutoSaveEvent[]> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .from('auto_save_events')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error getting recent auto-save events:', error);
    return [];
  }

  return (data || []).map((event: any) => ({
    id: event.id,
    user_id: event.user_id,
    event_id: event.event_id,
    speakers_saved: event.speakers_saved,
    speakers_processed: event.speakers_processed,
    status: event.status,
    error_message: event.error_message,
    created_at: event.created_at,
    completed_at: event.completed_at,
  }));
}

