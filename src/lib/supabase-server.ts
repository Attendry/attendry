import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function required(name: string, v?: string) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function supabaseServer() {
  // Check if environment variables are available
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables not configured');
  }
  
  const url  = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key  = required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const jar  = await cookies(); // Next 15

  return createServerClient(url, key, {
    cookies: {
      get(name: string) { 
        const cookie = jar.get(name);
        return cookie?.value; 
      },
      set(name: string, value: string, opts: CookieOptions) { 
        jar.set(name, value, {
          ...opts,
          httpOnly: false, // Allow client-side access
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        }); 
      },
      remove(name: string, opts: CookieOptions) { 
        jar.set(name, "", { 
          ...opts, 
          maxAge: 0,
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        }); 
      },
    },
  });
}