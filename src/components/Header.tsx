"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type UserLite = { id: string; email?: string | null };

export function Header() {
  const [user, setUser] = useState<UserLite | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const supabase = supabaseBrowser();

    // 1) Get current session once (SSR → CSR hydration safe)
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data.session?.user ?? null);
        setAuthReady(true);
      }
    });

    // 2) Subscribe to changes (login/logout across tabs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header style={{
      padding: "1rem 2rem", 
      borderBottom: "1px solid var(--border)",
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center",
      background: "var(--background)",
      position: "sticky",
      top: 0,
      zIndex: 50,
      backdropFilter: "blur(8px)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <Link href="/" style={{ 
          fontSize: "1.25rem", 
          fontWeight: "700", 
          color: "var(--foreground)",
          textDecoration: "none"
        }}>
          Attendry
        </Link>
        <nav style={{ display: "flex", gap: "1.5rem" }}>
          <Link href="/" style={{ 
            color: "var(--muted-foreground)", 
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: "500",
            transition: "color 0.2s ease"
          }}>
            Home
          </Link>
          <Link href="/events" style={{ 
            color: "var(--muted-foreground)", 
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: "500",
            transition: "color 0.2s ease"
          }}>
            Events
          </Link>
          <Link href="/watchlist" style={{ 
            color: "var(--muted-foreground)", 
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: "500",
            transition: "color 0.2s ease"
          }}>
            Watchlist
          </Link>
        </nav>
      </div>

      {/* Hide auth controls until we know the session to prevent flicker */}
      {!authReady ? null : user ? (
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <span style={{ 
            fontSize: "0.875rem", 
            color: "var(--muted-foreground)",
            fontWeight: "500"
          }}>
            {user.email ?? `User ${user.id.slice(0, 6)}`}
          </span>
          <button 
            onClick={() => supabaseBrowser().auth.signOut()}
            className="btn btn-secondary"
            style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Link 
            href="/admin" 
            style={{ 
              fontSize: "0.875rem", 
              color: "var(--muted-foreground)", 
              textDecoration: "none",
              fontWeight: "500",
              transition: "color 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--foreground)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted-foreground)"}
          >
            Admin
          </Link>
          <Link 
            href="/login" 
            className="btn btn-primary"
            style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}
          >
            Sign in
          </Link>
        </div>
      )}
    </header>
  );
}
