import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getUserDataSummary } from "@/lib/services/gdpr-service";

export const runtime = "nodejs";

/**
 * GET /api/gdpr/export/[requestId]/download - Download exported data
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { requestId: string } }
): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { requestId } = params;

    // Verify export request belongs to user
    const { data: exportRequest, error: exportError } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .single();

    if (exportError || !exportRequest) {
      return NextResponse.json(
        { success: false, error: "Export request not found" },
        { status: 404 }
      );
    }

    if (exportRequest.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: "Export not ready yet" },
        { status: 400 }
      );
    }

    // Check if export has expired
    if (exportRequest.expires_at && new Date(exportRequest.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: "Export has expired" },
        { status: 410 }
      );
    }

    // Generate export data on-demand
    const summary = await getUserDataSummary(user.id);
    
    // Fetch all user data
    const [contacts, research, events] = await Promise.all([
      supabase
        .from('saved_speaker_profiles')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('contact_research')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('collected_events')
        .select('*')
        .eq('user_id', user.id),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      summary,
      contacts: contacts.data || [],
      research: research.data || [],
      events: events.data || [],
    };

    // Convert to requested format
    let fileContent: string;
    let fileName: string;
    let contentType: string;

    if (exportRequest.format === 'json') {
      fileContent = JSON.stringify(exportData, null, 2);
      fileName = `user-data-export-${user.id}-${Date.now()}.json`;
      contentType = 'application/json';
    } else {
      // CSV format (simplified)
      fileContent = convertToCSV(exportData);
      fileName = `user-data-export-${user.id}-${Date.now()}.csv`;
      contentType = 'text/csv';
    }

    // Return file as download
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error("Error generating export download:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate export" },
      { status: 500 }
    );
  }
}

/**
 * Convert data to CSV (simplified)
 */
function convertToCSV(data: any): string {
  const lines: string[] = [];
  
  // Add header
  lines.push('Type,ID,Data');
  
  // Add contacts
  if (data.contacts) {
    data.contacts.forEach((contact: any) => {
      lines.push(`Contact,${contact.id},"${JSON.stringify(contact).replace(/"/g, '""')}"`);
    });
  }
  
  // Add research
  if (data.research) {
    data.research.forEach((r: any) => {
      lines.push(`Research,${r.id},"${JSON.stringify(r).replace(/"/g, '""')}"`);
    });
  }
  
  // Add events
  if (data.events) {
    data.events.forEach((event: any) => {
      lines.push(`Event,${event.id},"${JSON.stringify(event).replace(/"/g, '""')}"`);
    });
  }
  
  return lines.join('\n');
}

