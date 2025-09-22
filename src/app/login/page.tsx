



"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const supabase = supabaseBrowser();

  // Use window.origin so this works in dev and prod
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=/events`
      : undefined;

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/events`,
      },
    });
  }

  async function sendMagicLink(email: string) {
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/events` },
    });
  }

  return (
    <main style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      padding: "2rem",
      background: "linear-gradient(135deg, var(--muted) 0%, var(--background) 100%)"
    }}>
      <div style={{ 
        width: "100%", 
        maxWidth: "400px",
        background: "var(--background)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
        padding: "2rem"
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{
            fontSize: "1.875rem",
            fontWeight: "700",
            color: "var(--foreground)",
            marginBottom: "0.5rem"
          }}>
            Welcome to Attendry
          </h1>
          <p style={{
            fontSize: "1rem",
            color: "var(--muted-foreground)"
          }}>
            Sign in to discover and track events
          </p>
        </div>

        {/* Google Sign In Button */}
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            onClick={signInWithGoogle}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              backgroundColor: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--foreground)",
              fontSize: "0.875rem",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--background)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Divider */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          marginBottom: "1.5rem",
          color: "var(--muted-foreground)",
          fontSize: "0.875rem"
        }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }}></div>
          <span style={{ padding: "0 1rem" }}>or</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }}></div>
        </div>
        
        <Auth
          supabaseClient={supabaseBrowser()}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'var(--primary)',
                  brandAccent: 'var(--accent)',
                },
                space: {
                  spaceSmall: '0.5rem',
                  spaceMedium: '1rem',
                  spaceLarge: '1.5rem',
                },
                fontSizes: {
                  baseBodySize: '0.875rem',
                  baseInputSize: '0.875rem',
                },
                radii: {
                  borderRadiusButton: 'var(--radius)',
                  buttonBorderRadius: 'var(--radius)',
                  inputBorderRadius: 'var(--radius)',
                }
              }
            }
          }}
          view="magic_link"
          showLinks={false}
          redirectTo={redirectTo}
        />
        
        <p style={{ 
          fontSize: "0.875rem", 
          color: "var(--muted-foreground)", 
          marginTop: "1rem",
          textAlign: "center",
          lineHeight: "1.5"
        }}>
          We'll email you a secure link. No password needed.
        </p>
      </div>
    </main>
  );
}
