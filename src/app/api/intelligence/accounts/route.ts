/**
 * API Route: /api/intelligence/accounts
 * 
 * Handles CRUD operations for company accounts in Market Intelligence
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { z } from 'zod';

// Validation schemas
const CreateAccountSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  domain: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  description: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal(''))
});

const UpdateAccountSchema = CreateAccountSchema.partial();

const SearchAccountsSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50)
});

/**
 * GET /api/intelligence/accounts
 * List and search accounts
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = SearchAccountsSchema.parse(query);

    // Call the database function
    const { data, error } = await supabase.rpc('search_accounts', {
      search_term: validatedQuery.search || '',
      industry_filter: validatedQuery.industry || null,
      limit_count: validatedQuery.limit
    });

    if (error) {
      console.error('[API] Error searching accounts:', error);
      return NextResponse.json({ error: 'Failed to search accounts' }, { status: 500 });
    }

    return NextResponse.json({
      accounts: data || [],
      total: data?.length || 0,
      query: validatedQuery
    });

  } catch (error) {
    console.error('[API] Error in GET /api/intelligence/accounts:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid query parameters', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * POST /api/intelligence/accounts
 * Create a new account
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = CreateAccountSchema.parse(body);

    // Create account
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        ...validatedData,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Error creating account:', error);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    return NextResponse.json({
      account: data,
      message: 'Account created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Error in POST /api/intelligence/accounts:', error);
    
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
