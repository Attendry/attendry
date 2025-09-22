import { supabaseServer } from "@/lib/supabase-server";
import EventsClient from "@/app/events/EventsClient";

export default async function EventsPage() {
  // Fetch user's saved events for initial state
  const supabase = await supabaseServer();
  const { data: me } = await supabase.auth.getUser();
  let savedSet = new Set<string>();
  
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

  return <EventsClient initialSavedSet={savedSet} />;
}
