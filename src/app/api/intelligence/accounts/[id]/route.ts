/**
 * API Route: /api/intelligence/accounts/[id]
 * 
 * Handles individual account operations (GET, PUT, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { z } from 'zod';

const UpdateAccountSchema = z.object({
  company_name: z.string().min(1).optional(),
  domain: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  description: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal(''))
});

/**
 * GET /api/intelligence/accounts/[id]
 * Get account details with intelligence summary
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;

    // Get account with intelligence summary
    const { data: summary, error: summaryError } = await supabase.rpc(
      'get_account_intelligence_summary',
      { account_uuid: accountId }
    );

    if (summaryError) {
      console.error('[API] Error getting account summary:', summaryError);
      return NextResponse.json({ error: 'Failed to get account summary' }, { status: 500 });
    }

    if (!summary || summary.length === 0) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('created_by', user.id)
      .single();

    if (accountError) {
      console.error('[API] Error getting account details:', accountError);
      return NextResponse.json({ error: 'Failed to get account details' }, { status: 500 });
    }

    return NextResponse.json({
      account,
      summary: summary[0]
    });

  } catch (error) {
    console.error('[API] Error in GET /api/intelligence/accounts/[id]:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * PUT /api/intelligence/accounts/[id]
 * Update account
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;

    // Parse and validate request body
    const body = await req.json();
    const validatedData = UpdateAccountSchema.parse(body);

    // Update account
    const { data, error } = await supabase
      .from('accounts')
      .update(validatedData)
      .eq('id', accountId)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) {
      console.error('[API] Error updating account:', error);
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    return NextResponse.json({
      account: data,
      message: 'Account updated successfully'
    });

  } catch (error) {
    console.error('[API] Error in PUT /api/intelligence/accounts/[id]:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * DELETE /api/intelligence/accounts/[id]
 * Delete account
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;

    // Delete account (cascade will handle related records)
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('created_by', user.id);

    if (error) {
      console.error('[API] Error deleting account:', error);
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('[API] Error in DELETE /api/intelligence/accounts/[id]:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
