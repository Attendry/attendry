export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(
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

    const boardItemId = params.id;

    // Get the board item with event data
    const { data: boardItem, error: boardError } = await supabase
      .from('user_event_board')
      .select(`
        *,
        collected_events (
          id,
          title,
          starts_at,
          speakers,
          sponsors,
          participating_organizations
        )
      `)
      .eq('id', boardItemId)
      .eq('user_id', userRes.user.id)
      .single();

    if (boardError || !boardItem) {
      return NextResponse.json({ 
        success: false,
        error: "Board item not found" 
      }, { status: 404 });
    }

    const event = boardItem.collected_events || boardItem.event_data;
    if (!event) {
      return NextResponse.json({ 
        success: false,
        error: "Event data not found" 
      }, { status: 404 });
    }

    // Extract contacts from event
    const contacts: Array<{ name: string; org?: string; title?: string; type: string }> = [];

    // Add speakers
    if (event.speakers && Array.isArray(event.speakers)) {
      event.speakers.forEach((speaker: any) => {
        if (speaker?.name) {
          contacts.push({
            name: speaker.name,
            org: speaker.org || speaker.organization,
            title: speaker.title,
            type: 'speaker'
          });
        }
      });
    }

    // Add sponsors (if they have names)
    if (event.sponsors && Array.isArray(event.sponsors)) {
      event.sponsors.forEach((sponsor: any) => {
        if (typeof sponsor === 'string' && sponsor.trim()) {
          contacts.push({
            name: sponsor.trim(),
            type: 'sponsor'
          });
        } else if (sponsor?.name) {
          contacts.push({
            name: sponsor.name,
            org: sponsor.org || sponsor.organization,
            type: 'sponsor'
          });
        }
      });
    }

    // Add participating organizations (as contacts)
    if (event.participating_organizations && Array.isArray(event.participating_organizations)) {
      event.participating_organizations.forEach((org: any) => {
        if (typeof org === 'string' && org.trim()) {
          contacts.push({
            name: org.trim(),
            type: 'organization'
          });
        } else if (org?.name) {
          contacts.push({
            name: org.name,
            org: org.org || org.organization,
            type: 'organization'
          });
        }
      });
    }

    if (contacts.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: "No contacts found in this event" 
      }, { status: 400 });
    }

    // Create or find saved speaker profiles for each contact
    const contactIds: string[] = [];
    const errors: string[] = [];

    for (const contact of contacts) {
      try {
        // Check if profile already exists
        const { data: existing, error: checkError } = await supabase
          .from('saved_speaker_profiles')
          .select('id')
          .eq('user_id', userRes.user.id)
          .eq('speaker_data->>name', contact.name)
          .limit(1)
          .maybeSingle();

        if (existing) {
          contactIds.push(existing.id);
          continue;
        }

        // If checkError is not a "not found" error, log it but continue
        if (checkError && checkError.code !== 'PGRST116') {
          console.warn(`Error checking for existing profile for ${contact.name}:`, checkError);
        }

        // Create new profile
        const { data: newProfile, error: createError } = await supabase
          .from('saved_speaker_profiles')
          .insert({
            user_id: userRes.user.id,
            speaker_data: {
              name: contact.name,
              org: contact.org,
              organization: contact.org,
              title: contact.title,
            },
            enhanced_data: {
              name: contact.name,
              organization: contact.org,
              title: contact.title,
            },
            source_event_id: event.id || null,
            source_event_url: boardItem.event_url,
            notes: `Added from event: ${event.title || 'Unknown Event'}`,
          })
          .select('id')
          .single();

        if (createError || !newProfile) {
          // If it's a duplicate key error, try to find it again
          if (createError?.code === '23505') {
            const { data: found } = await supabase
              .from('saved_speaker_profiles')
              .select('id')
              .eq('user_id', userRes.user.id)
              .eq('speaker_data->>name', contact.name)
              .limit(1)
              .maybeSingle();
            if (found) {
              contactIds.push(found.id);
              continue;
            }
          }
          errors.push(`${contact.name}: ${createError?.message || 'Failed to create'}`);
        } else {
          contactIds.push(newProfile.id);
        }
      } catch (err: any) {
        errors.push(`${contact.name}: ${err.message || 'Unknown error'}`);
      }
    }

    if (contactIds.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: "Failed to create any contacts",
        errors
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      contactIds,
      contactsCreated: contactIds.length,
      totalContacts: contacts.length,
      errors: errors.length > 0 ? errors : undefined,
      eventTitle: event.title,
      eventId: event.id
    });
  } catch (e: any) {
    console.error('Error creating outreach list:', e);
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to create outreach list" 
    }, { status: 500 });
  }
}

