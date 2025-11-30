/**
 * Saved Searches Service
 * Manages user-saved search queries for quick access
 */

import { supabaseServer } from '@/lib/supabase-server';

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  query?: string;
  filters: {
    country?: string;
    dateFrom?: string;
    dateTo?: string;
    keywords?: string;
  };
  is_pinned: boolean;
  last_run_at?: string;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedSearchInput {
  name: string;
  query?: string;
  filters?: {
    country?: string;
    dateFrom?: string;
    dateTo?: string;
    keywords?: string;
  };
  is_pinned?: boolean;
}

/**
 * Get all saved searches for the current user
 */
export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
  const supabase = await supabaseServer();
  
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved searches:', error);
    throw new Error('Failed to fetch saved searches');
  }

  return data || [];
}

/**
 * Create a new saved search
 */
export async function createSavedSearch(
  userId: string,
  input: CreateSavedSearchInput
): Promise<SavedSearch> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      user_id: userId,
      name: input.name,
      query: input.query || null,
      filters: input.filters || {},
      is_pinned: input.is_pinned || false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating saved search:', error);
    throw new Error('Failed to create saved search');
  }

  return data;
}

/**
 * Update a saved search
 */
export async function updateSavedSearch(
  userId: string,
  searchId: string,
  updates: Partial<CreateSavedSearchInput>
): Promise<SavedSearch> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from('saved_searches')
    .update({
      name: updates.name,
      query: updates.query,
      filters: updates.filters,
      is_pinned: updates.is_pinned,
    })
    .eq('id', searchId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating saved search:', error);
    throw new Error('Failed to update saved search');
  }

  return data;
}

/**
 * Delete a saved search
 */
export async function deleteSavedSearch(
  userId: string,
  searchId: string
): Promise<void> {
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', searchId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting saved search:', error);
    throw new Error('Failed to delete saved search');
  }
}

/**
 * Increment run count and update last_run_at
 */
export async function recordSavedSearchRun(
  userId: string,
  searchId: string
): Promise<void> {
  const supabase = await supabaseServer();

  // Fetch current value to increment
  const { data: current, error: fetchError } = await supabase
    .from('saved_searches')
    .select('run_count')
    .eq('id', searchId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !current) {
    console.error('Error fetching saved search for increment:', fetchError);
    // Don't throw - this is not critical
    return;
  }

  // Update with incremented value
  const { error } = await supabase
    .from('saved_searches')
    .update({
      last_run_at: new Date().toISOString(),
      run_count: (current.run_count || 0) + 1,
    })
    .eq('id', searchId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error recording saved search run:', error);
    // Don't throw - this is not critical
  }
}

