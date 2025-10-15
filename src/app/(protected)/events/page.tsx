import { supabaseServer } from "@/lib/supabase-server";
import EventsPageNew from "./EventsPageNew";
import { getInitialSavedEvents } from "@/lib/events/saved";

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const initialSaved = await getInitialSavedEvents();
  return <EventsPageNew initialSavedSet={initialSaved} />;
}
