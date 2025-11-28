import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  researchContact,
  checkForUpdates,
  saveContactResearch,
  getContactResearch,
  updateContactResearchWithIntel,
  clearNewIntelFlag,
} from '@/lib/services/contact-research-service';

export const runtime = 'nodejs';

/**
 * GET /api/contacts/[contactId]/research
 * Get research data for a contact
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { contactId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { contactId } = params;

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await supabase
      .from('saved_speaker_profiles')
      .select('id')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    const research = await getContactResearch(user.id, contactId);

    return NextResponse.json({
      success: true,
      research: research || null,
    });
  } catch (error: any) {
    console.error('Error getting contact research:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get research' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contacts/[contactId]/research
 * Research a contact (generate new research)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { contactId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { contactId } = params;

    // Get contact details
    const { data: contact, error: contactError } = await supabase
      .from('saved_speaker_profiles')
      .select('speaker_data')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    const name = contact.speaker_data?.name || 'Unknown';
    const company = contact.speaker_data?.org || contact.speaker_data?.organization || 'Unknown';

    // Research the contact
    const researchResult = await researchContact(name, company);

    // Save to database
    const savedResearch = await saveContactResearch(user.id, contactId, researchResult);

    return NextResponse.json({
      success: true,
      research: savedResearch,
    });
  } catch (error: any) {
    console.error('Error researching contact:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to research contact' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contacts/[contactId]/research/check-updates
 * Check for updates on a monitored contact
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { contactId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { contactId } = params;

    // Get contact and existing research
    const { data: contact, error: contactError } = await supabase
      .from('saved_speaker_profiles')
      .select('speaker_data')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    const existingResearch = await getContactResearch(user.id, contactId);
    if (!existingResearch || !existingResearch.background_info) {
      return NextResponse.json(
        { success: false, error: 'No existing research found. Please research the contact first.' },
        { status: 400 }
      );
    }

    const name = contact.speaker_data?.name || 'Unknown';
    const company = contact.speaker_data?.org || contact.speaker_data?.organization || 'Unknown';

    // Check for updates
    const newIntel = await checkForUpdates(name, company, existingResearch.background_info);

    if (newIntel) {
      // Update research with new intel
      await updateContactResearchWithIntel(user.id, contactId, newIntel);
    }

    return NextResponse.json({
      success: true,
      hasUpdates: !!newIntel,
      newIntel: newIntel || null,
    });
  } catch (error: any) {
    console.error('Error checking updates:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check updates' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/[contactId]/research/new-intel
 * Clear the new intel flag (user has seen the update)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { contactId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { contactId } = params;

    await clearNewIntelFlag(user.id, contactId);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Error clearing intel flag:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to clear intel flag' },
      { status: 500 }
    );
  }
}

