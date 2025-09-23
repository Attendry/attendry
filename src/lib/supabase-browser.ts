"use client";
import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      cookies: {
        // Disable client-side cookie access to keep tokens HttpOnly-only
        get() { return undefined; },
        set() { /* no-op */ },
        remove() { /* no-op */ }
      }
    }
  );
}
