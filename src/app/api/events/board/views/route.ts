export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// GET - List all saved views for user
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const viewType = searchParams.get('view_type'); // 'kanban' | 'list'

    let query = supabase
      .from('user_saved_views')
      .select('*')
      .eq('user_id', userRes.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (viewType) {
      query = query.eq('view_type', viewType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      views: data || [] 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to list saved views" 
    }, { status: 500 });
  }
}

// POST - Create a new saved view
export async function POST(req: NextRequest): Promise<NextResponse> {
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
    const { name, view_type, filters, columns, sort, density, is_default } = body;

    if (!name || !view_type) {
      return NextResponse.json({ 
        success: false,
        error: "name and view_type are required" 
      }, { status: 400 });
    }

    // Validate view_type
    if (!['kanban', 'list'].includes(view_type)) {
      return NextResponse.json({ 
        success: false,
        error: "view_type must be 'kanban' or 'list'" 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_saved_views')
      .insert({
        user_id: userRes.user.id,
        name,
        view_type,
        filters: filters || {},
        columns: columns || [],
        sort: sort || { field: 'added', direction: 'desc' },
        density: density || 'comfortable',
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ 
          success: false,
          error: "A view with this name already exists" 
        }, { status: 409 });
      }
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      view: data 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to create saved view" 
    }, { status: 500 });
  }
}

