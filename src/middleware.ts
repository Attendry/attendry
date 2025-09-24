import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Use consistent cookie settings across all Supabase clients
          res.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            // Add domain if needed for production
            ...(process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL ? {
              domain: new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
            } : {})
          });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { 
            ...options, 
            maxAge: 0,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            // Add domain if needed for production
            ...(process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SITE_URL ? {
              domain: new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
            } : {})
          });
        },
      },
    }
  );

  // Touch auth so refresh tokens are applied to response cookies when needed
  await supabase.auth.getUser().catch(() => null);

  return res;
}

// run on everything except static assets; include /api so server routes also stay fresh
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
