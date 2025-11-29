import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

/**
 * Check if a speaker is already saved as a contact for the current user
 * 
 * POST /api/speakers/check-saved
 * Body: { name: string, org?: string }
 * 
 * Returns: { isSaved: boolean, contactId?: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, org } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: "Speaker name is required" },
        { status: 400 }
      );
    }

    // Normalize name and org for matching
    const normalizedName = name.trim().toLowerCase();
    const normalizedOrg = org ? org.trim().toLowerCase() : null;

    // Query saved_speaker_profiles for matching speaker
    // Match on normalized name and org (case-insensitive)
    let query = supabase
      .from('saved_speaker_profiles')
      .select('id, speaker_data')
      .eq('user_id', user.id)
      .eq('archived', false); // Only check non-archived contacts

    // Use PostgreSQL JSONB operators for case-insensitive matching
    // Match on speaker_data->>'name' (normalized) and speaker_data->>'org' (normalized)
    const { data: contacts, error } = await query;

    if (error) {
      console.error('[check-saved] Database error:', error);
      return NextResponse.json(
        { error: "Failed to check save status" },
        { status: 500 }
      );
    }

    // Check if any contact matches (case-insensitive)
    const isSaved = contacts?.some(contact => {
      const contactName = contact.speaker_data?.name?.trim().toLowerCase();
      const contactOrg = contact.speaker_data?.org?.trim().toLowerCase();
      
      // Exact name match required
      if (contactName !== normalizedName) {
        return false;
      }
      
      // If org provided, must match (or both null/empty)
      if (normalizedOrg) {
        return contactOrg === normalizedOrg;
      }
      
      // If no org provided, match if contact also has no org
      return !contactOrg || contactOrg === '';
    }) || false;

    const contactId = isSaved 
      ? contacts?.find(contact => {
          const contactName = contact.speaker_data?.name?.trim().toLowerCase();
          const contactOrg = contact.speaker_data?.org?.trim().toLowerCase();
          return contactName === normalizedName && 
                 (normalizedOrg ? contactOrg === normalizedOrg : !contactOrg);
        })?.id
      : undefined;

    return NextResponse.json({
      isSaved,
      contactId: contactId || undefined
    });

  } catch (error) {
    console.error('[check-saved] Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Batch check multiple speakers
 * 
 * POST /api/speakers/check-saved
 * Body: { speakers: Array<{ name: string, org?: string }> }
 * 
 * Returns: { results: Array<{ name: string, org?: string, isSaved: boolean, contactId?: string }> }
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { speakers } = body;

    if (!Array.isArray(speakers) || speakers.length === 0) {
      return NextResponse.json(
        { error: "Speakers array is required" },
        { status: 400 }
      );
    }

    // Get all saved contacts for user
    const { data: contacts, error } = await supabase
      .from('saved_speaker_profiles')
      .select('id, speaker_data')
      .eq('user_id', user.id)
      .eq('archived', false);

    if (error) {
      console.error('[check-saved-batch] Database error:', error);
      return NextResponse.json(
        { error: "Failed to check save status" },
        { status: 500 }
      );
    }

    // Check each speaker
    const results = speakers.map((speaker: { name: string; org?: string }) => {
      const normalizedName = speaker.name.trim().toLowerCase();
      const normalizedOrg = speaker.org ? speaker.org.trim().toLowerCase() : null;

      const matchingContact = contacts?.find(contact => {
        const contactName = contact.speaker_data?.name?.trim().toLowerCase();
        const contactOrg = contact.speaker_data?.org?.trim().toLowerCase();
        
        if (contactName !== normalizedName) return false;
        
        if (normalizedOrg) {
          return contactOrg === normalizedOrg;
        }
        
        return !contactOrg || contactOrg === '';
      });

      return {
        name: speaker.name,
        org: speaker.org,
        isSaved: !!matchingContact,
        contactId: matchingContact?.id
      };
    });

    return NextResponse.json({ results });

  } catch (error) {
    console.error('[check-saved-batch] Unexpected error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

