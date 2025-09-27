/**
 * Admin Users API
 * 
 * This endpoint provides user management functionality for admins.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * User interface
 */
interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_active: boolean;
  profile?: any;
}

/**
 * GET /api/admin/users
 */
export async function GET(): Promise<NextResponse<{ users: User[] }>> {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get all users
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Transform users data
    const transformedUsers: User[] = (users || []).map(user => ({
      id: user.id,
      email: user.email || 'No email',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at || '',
      is_active: user.is_active !== false,
      profile: user,
    }));

    return NextResponse.json({ users: transformedUsers });

  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Failed to load users' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { action, userId, data } = await req.json();

    switch (action) {
      case 'update':
        const { error: updateError } = await supabase
          .from('profiles')
          .update(data)
          .eq('id', userId);

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to update user' },
            { status: 500 }
          );
        }

        return NextResponse.json({ message: 'User updated successfully' });

      case 'delete':
        const { error: deleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (deleteError) {
          return NextResponse.json(
            { error: 'Failed to delete user' },
            { status: 500 }
          );
        }

        return NextResponse.json({ message: 'User deleted successfully' });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
