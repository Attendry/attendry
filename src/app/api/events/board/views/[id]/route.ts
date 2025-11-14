export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// GET - Get a specific saved view
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_saved_views')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', userRes.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ 
        success: false,
        error: "Saved view not found" 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      view: data 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to get saved view" 
    }, { status: 500 });
  }
}

// PATCH - Update a saved view
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('user_saved_views')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', userRes.user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ 
        success: false,
        error: "Saved view not found or access denied" 
      }, { status: 404 });
    }

    const body = await req.json();
    const updateData: any = {};
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.filters !== undefined) updateData.filters = body.filters;
    if (body.columns !== undefined) updateData.columns = body.columns;
    if (body.sort !== undefined) updateData.sort = body.sort;
    if (body.density !== undefined) updateData.density = body.density;
    if (body.is_default !== undefined) updateData.is_default = body.is_default;

    const { data, error } = await supabase
      .from('user_saved_views')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
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
      error: e?.message || "Failed to update saved view" 
    }, { status: 500 });
  }
}

// DELETE - Delete a saved view
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('user_saved_views')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', userRes.user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ 
        success: false,
        error: "Saved view not found or access denied" 
      }, { status: 404 });
    }

    const { error } = await supabase
      .from('user_saved_views')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true 
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to delete saved view" 
    }, { status: 500 });
  }
}

