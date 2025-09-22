"use client";
import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined;
          const value = document.cookie
            .split('; ')
            .find(row => row.startsWith(`${name}=`))
            ?.split('=')[1];
          return value;
        },
        set(name: string, value: string, options: any) {
          if (typeof document === 'undefined') return;
          const cookieOptions = {
            ...options,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
            // Remove domain restriction - let browser handle it
          };
          document.cookie = `${name}=${value}; ${Object.entries(cookieOptions)
            .filter(([_, val]) => val !== undefined)
            .map(([key, val]) => `${key}=${val}`)
            .join('; ')}`;
        },
        remove(name: string, options: any) {
          if (typeof document === 'undefined') return;
          const cookieOptions = {
            ...options,
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
            // Remove domain restriction - let browser handle it
          };
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${Object.entries(cookieOptions)
            .filter(([_, val]) => val !== undefined)
            .map(([key, val]) => `${key}=${val}`)
            .join('; ')}`;
        }
      }
    }
  );
}
