import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url.trim();
  }
}

export function computeExtractionKey(url: string, eventDate: string | null): string {
  const normalized = normalizeUrl(url);
  const base = eventDate ? `${normalized}::${eventDate}` : normalized;
  return crypto.createHash('sha256').update(base).digest('hex');
}

export async function fetchCachedExtraction(url: string, eventDate: string | null) {
  const normalized = normalizeUrl(url);
  const supabase = supabaseAdmin();
  const query = supabase
    .from('event_extractions')
    .select('*')
    .eq('normalized_url', normalized)
    .order('refreshed_at', { ascending: false })
    .limit(1);

  const { data, error } = eventDate
    ? await query.eq('event_date', eventDate)
    : await query.is('event_date', null);

  if (error) {
    console.warn('[cache] Failed to fetch cached extraction', error);
    return null;
  }
  return data;
}

export async function upsertCachedExtraction(input: {
  url: string;
  eventDate: string | null;
  country: string | null;
  city: string | null;
  payload: Record<string, unknown>;
}) {
  const supabase = supabaseAdmin();
  const normalized = normalizeUrl(input.url);
  const { error } = await supabase
    .from('event_extractions')
    .upsert({
      url: input.url,
      normalized_url: normalized,
      event_date: input.eventDate ?? null,
      country: input.country,
      locality: input.city,
      payload: input.payload,
      refreshed_at: new Date().toISOString(),
    }, { onConflict: 'normalized_url,event_date' });

  if (error) {
    console.warn('[cache] Failed to upsert cached extraction', error);
  }
}
