import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Force Node.js runtime for middleware to avoid Edge Runtime issues with Supabase
export const runtime = 'nodejs';

const AUTH_PATH_PREFIXES = ['/watchlist', '/api/watchlist'];

const ADMIN_PATH_PREFIXES = ['/admin', '/api/admin'];

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

  const {
    data: { session },
  } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

  const pathname = req.nextUrl.pathname;

  const requiresAuth = AUTH_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const requiresAdmin = ADMIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!session && (requiresAuth || requiresAdmin)) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (session && requiresAdmin) {
    const { data: roleRow, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const role = error ? null : (roleRow?.role as string | null);
    if (role !== 'Admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return res;
}

// run on everything except static assets; include /api so server routes also stay fresh
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
