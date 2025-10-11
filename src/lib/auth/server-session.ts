import { supabaseServer } from '@/lib/supabase-server';

export async function getServerSession() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) {
    return { supabase, session: null };
  }
  return { supabase, session: data.session };
}