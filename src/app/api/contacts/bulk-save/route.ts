import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { bulkSaveSpeakers } from "@/lib/services/bulk-save-service";
import { SpeakerData } from "@/lib/types/core";

export const runtime = "nodejs";

/**
 * POST /api/contacts/bulk-save
 * Bulk save speakers as contacts
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { speakers, eventId, eventTitle } = body;

    if (!Array.isArray(speakers) || speakers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Speakers array is required" },
        { status: 400 }
      );
    }

    // Convert to SpeakerData format
    const speakerData: SpeakerData[] = speakers.map((s: any) => ({
      name: s.name || "",
      org: s.org || s.organization || "",
      title: s.title || "",
      email: s.email || "",
      linkedin_url: s.linkedin_url || s.linkedin || "",
      profile_url: s.profile_url || "",
      bio: s.bio || "",
      enhanced_data: s.enhanced_data,
    }));

    // Perform bulk save
    const progress = await bulkSaveSpeakers(speakerData, user.id, {
      eventId,
      eventTitle,
    });

    return NextResponse.json({
      success: true,
      progress,
    });
  } catch (error: any) {
    console.error("Error in bulk save:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save contacts" },
      { status: 500 }
    );
  }
}

