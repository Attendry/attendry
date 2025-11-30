import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  getSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  type CreateSavedSearchInput,
} from '@/lib/services/saved-searches-service';

export async function GET(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searches = await getSavedSearches(session.user.id);

    return NextResponse.json({
      success: true,
      searches,
    });
  } catch (error) {
    console.error('Error fetching saved searches:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch saved searches' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    
    // Validation
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const trimmedName = body.name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existing = await getSavedSearches(session.user.id);
    if (existing.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'A saved search with this name already exists' },
        { status: 409 }
      );
    }

    const input: CreateSavedSearchInput = {
      name: trimmedName,
      query: body.query?.trim() || undefined,
      filters: body.filters || {},
      is_pinned: body.is_pinned || false,
    };

    const search = await createSavedSearch(session.user.id, input);

    return NextResponse.json({
      success: true,
      search,
    });
  } catch (error) {
    console.error('Error creating saved search:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create saved search' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Search ID required' },
        { status: 400 }
      );
    }

    const search = await updateSavedSearch(session.user.id, id, updates);

    return NextResponse.json({
      success: true,
      search,
    });
  } catch (error) {
    console.error('Error updating saved search:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update saved search' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Search ID required' },
        { status: 400 }
      );
    }

    await deleteSavedSearch(session.user.id, id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete saved search' },
      { status: 500 }
    );
  }
}

