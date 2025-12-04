export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { ColumnStatus } from "@/lib/types/event-board";

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const body = await req.json();
    const { itemIds, action, data } = body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: "itemIds must be a non-empty array" 
      }, { status: 400 });
    }

    if (!action || !['status', 'delete', 'tags'].includes(action)) {
      return NextResponse.json({ 
        success: false,
        error: "Invalid action. Must be 'status', 'delete', or 'tags'" 
      }, { status: 400 });
    }

    // Verify all items belong to the user
    const { data: items, error: itemsError } = await supabase
      .from('user_event_board')
      .select('id')
      .eq('user_id', userRes.user.id)
      .in('id', itemIds);

    if (itemsError) {
      return NextResponse.json({ 
        success: false,
        error: itemsError.message 
      }, { status: 400 });
    }

    if (items.length !== itemIds.length) {
      return NextResponse.json({ 
        success: false,
        error: "Some items not found or don't belong to you" 
      }, { status: 403 });
    }

    let result;

    switch (action) {
      case 'status':
        if (!data?.status || !['interested', 'researching', 'attending', 'follow-up', 'archived'].includes(data.status)) {
          return NextResponse.json({ 
            success: false,
            error: "Invalid status" 
          }, { status: 400 });
        }

        const { error: statusError } = await supabase
          .from('user_event_board')
          .update({ 
            column_status: data.status as ColumnStatus,
            updated_at: new Date().toISOString()
          })
          .in('id', itemIds)
          .eq('user_id', userRes.user.id);

        if (statusError) {
          return NextResponse.json({ 
            success: false,
            error: statusError.message 
          }, { status: 500 });
        }

        result = { updated: itemIds.length, status: data.status };
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from('user_event_board')
          .delete()
          .in('id', itemIds)
          .eq('user_id', userRes.user.id);

        if (deleteError) {
          return NextResponse.json({ 
            success: false,
            error: deleteError.message 
          }, { status: 500 });
        }

        result = { deleted: itemIds.length };
        break;

      case 'tags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json({ 
            success: false,
            error: "tags must be an array" 
          }, { status: 400 });
        }

        const { data: currentItems, error: fetchError } = await supabase
          .from('user_event_board')
          .select('id, tags')
          .in('id', itemIds)
          .eq('user_id', userRes.user.id);

        if (fetchError) {
          return NextResponse.json({ 
            success: false,
            error: fetchError.message 
          }, { status: 500 });
        }

        const updates = currentItems.map(item => {
          const currentTags = item.tags || [];
          const newTags = data.action === 'add'
            ? [...new Set([...currentTags, ...data.tags])]
            : currentTags.filter((tag: string) => !data.tags.includes(tag));

          return {
            id: item.id,
            tags: newTags,
            updated_at: new Date().toISOString()
          };
        });

        // Update each item individually (Supabase doesn't support array operations in bulk update easily)
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('user_event_board')
            .update({ 
              tags: update.tags,
              updated_at: update.updated_at
            })
            .eq('id', update.id)
            .eq('user_id', userRes.user.id);

          if (updateError) {
            return NextResponse.json({ 
              success: false,
              error: updateError.message 
            }, { status: 500 });
          }
        }

        result = { updated: itemIds.length, tags: data.tags, action: data.action };
        break;

      default:
        return NextResponse.json({ 
          success: false,
          error: "Invalid action" 
        }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      ...result
    });
  } catch (e: any) {
    console.error('Error in bulk operation:', e);
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to perform bulk operation" 
    }, { status: 500 });
  }
}

