import { supabaseServer } from "@/lib/supabase-server";
import EventsPageNew from "@/app/(protected)/events/EventsPageNew";

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  // Fetch user's saved events for initial state
  let savedSet = new Set<string>();
  
  try {
    const supabase = await supabaseServer();
    const { data: me } = await supabase.auth.getUser();
    
    if (me?.user) {
      try {
        // Use the same supabase instance to call the RPC directly instead of HTTP fetch
        const { data, error } = await supabase
          .from("watchlists")
          .select("ref_id")
          .eq("owner", me.user.id)
          .eq("kind", "event");
        
        if (!error && data) {
          savedSet = new Set(data.map(r => r.ref_id));
        }
      } catch (error) {
        // If fetch fails, continue with empty set
        console.warn('Failed to fetch saved events:', error);
      }
    }
  } catch (error) {
    // If Supabase is not configured, continue with empty set
    console.warn('Supabase not configured, using empty saved set:', error);
  }

  return <EventsPageNew initialSavedSet={savedSet} />;
}
