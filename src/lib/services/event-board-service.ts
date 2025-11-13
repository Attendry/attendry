/**
 * Event Board Service
 * 
 * Service for managing user event board operations
 */

import { supabaseServer } from '@/lib/supabase-server';
import { UserEventBoardItem } from '@/lib/types/database';
import { AddEventToBoardRequest, UpdateBoardItemRequest, ColumnStatus } from '@/lib/types/event-board';

export class EventBoardService {
  /**
   * Add event to user's board
   */
  static async addEventToBoard(
    userId: string,
    request: AddEventToBoardRequest
  ): Promise<UserEventBoardItem> {
    const supabase = await supabaseServer();

    const { eventId, eventUrl, columnStatus = 'interested' } = request;

    // Check if already exists
    const { data: existing } = await supabase
      .from('user_event_board')
      .select('id')
      .eq('user_id', userId)
      .eq('event_url', eventUrl)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('user_event_board')
        .update({
          event_id: eventId || null,
          column_status: columnStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    // Insert new
    const { data, error } = await supabase
      .from('user_event_board')
      .insert({
        user_id: userId,
        event_id: eventId || null,
        event_url: eventUrl,
        column_status: columnStatus,
        position: 0
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all board items for user
   */
  static async getBoardItems(
    userId: string,
    status?: ColumnStatus
  ): Promise<UserEventBoardItem[]> {
    const supabase = await supabaseServer();

    let query = supabase
      .from('user_event_board')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .order('added_at', { ascending: false });

    if (status) {
      query = query.eq('column_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Update board item
   */
  static async updateBoardItem(
    userId: string,
    itemId: string,
    updates: UpdateBoardItemRequest
  ): Promise<UserEventBoardItem> {
    const supabase = await supabaseServer();

    // Verify ownership
    const { data: existing } = await supabase
      .from('user_event_board')
      .select('id')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      throw new Error('Board item not found or access denied');
    }

    const updateData: any = {};
    if (updates.columnStatus !== undefined) updateData.column_status = updates.columnStatus;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.tags !== undefined) updateData.tags = updates.tags;

    const { data, error } = await supabase
      .from('user_event_board')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Remove board item
   */
  static async removeBoardItem(
    userId: string,
    itemId: string
  ): Promise<void> {
    const supabase = await supabaseServer();

    // Verify ownership
    const { data: existing } = await supabase
      .from('user_event_board')
      .select('id')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      throw new Error('Board item not found or access denied');
    }

    const { error } = await supabase
      .from('user_event_board')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  }

  /**
   * Reorder items in a column
   */
  static async reorderColumn(
    userId: string,
    columnStatus: ColumnStatus,
    itemIds: string[]
  ): Promise<void> {
    const supabase = await supabaseServer();

    // Update positions for all items in the column
    const updates = itemIds.map((id, index) => ({
      id,
      position: index
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('user_event_board')
        .update({ position: update.position })
        .eq('id', update.id)
        .eq('user_id', userId)
        .eq('column_status', columnStatus);

      if (error) throw error;
    }
  }
}

