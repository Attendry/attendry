



"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Initialize Supabase client only on client side
    setSupabase(supabaseBrowser());
  }, []);

  async function signInWithGoogle() {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage(`Google sign-in error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMagicLink() {
    if (!supabase) return;
    if (!email) {
      setMessage("Please enter your email address");
      return;
    }
    
    setIsLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { 
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=/dashboard` 
        },
      });
      if (error) throw error;
      setMessage("Magic link sent! Check your email and click the link to sign in. After clicking the link, you may need to use the 'Fix Session' button in the AuthHelper widget to ensure cookies are set properly.");
    } catch (error: any) {
      setMessage(`Magic link error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithPassword() {
    if (!email || !password) {
      setMessage("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success") {
        const errorMsg = data?.message || "Failed to sign in";
        setMessage(`Sign-in error: ${errorMsg}`);
        return;
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("testEmail", email);
        } catch {
          // ignore storage issues
        }
      }

      setMessage("Signed in successfully. Redirecting...");
      router.push("/dashboard");
      router.refresh();
    } catch (error: any) {
      console.error("Unexpected sign-in error:", error);
      setMessage(`Unexpected error: ${error.message || "Something went wrong"}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function createTestUser() {
    if (!email || !password) {
      setMessage("Please enter both email and password");
      return;
    }
    
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch('/api/auth/create-test-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setMessage("Test user created! You can now sign in with your email and password.");
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Show loading state while Supabase client is initializing
  if (!supabase) {
    return (
      <main style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        padding: "2rem",
        background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)"
      }}>
        <div style={{ 
          textAlign: "center",
          color: "var(--muted-foreground)"
        }}>
          <div style={{ 
            width: "40px", 
            height: "40px", 
            border: "3px solid var(--border)",
            borderTop: "3px solid var(--primary)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem"
          }}></div>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      padding: "2rem",
      background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)"
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
            Welcome Back
          </h1>
          <p style={{
            fontSize: "1rem",
            color: "var(--muted-foreground)"
          }}>
            Sign in to continue discovering events that drive your growth
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

        {/* Email Input */}
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="email" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "500", color: "var(--foreground)" }}>
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (usePassword) {
                  signInWithPassword();
                } else {
                  sendMagicLink();
                }
              }
            }}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: "0.875rem",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              outline: "none",
              transition: "border-color 0.2s ease"
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          />
        </div>

        {/* Password Input (conditional) */}
        {usePassword && (
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "500", color: "var(--foreground)" }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  signInWithPassword();
                }
              }}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "0.875rem",
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
                outline: "none",
                transition: "border-color 0.2s ease"
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
              onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            />
          </div>
        )}

        {/* Sign In Buttons */}
        <div style={{ marginBottom: "1rem" }}>
          {usePassword ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={signInWithPassword}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  backgroundColor: isLoading ? "#9ca3af" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s ease",
                  opacity: isLoading ? 0.7 : 1
                }}
              >
                {isLoading ? "Signing in..." : "Sign in with Password"}
              </button>
              <button
                onClick={createTestUser}
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  backgroundColor: isLoading ? "#9ca3af" : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s ease",
                  opacity: isLoading ? 0.7 : 1
                }}
              >
                {isLoading ? "Creating..." : "Create Test User"}
              </button>
            </div>
          ) : (
            <button
              onClick={sendMagicLink}
              disabled={isLoading}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                backgroundColor: isLoading ? "#9ca3af" : "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: "500",
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "background-color 0.2s ease",
                opacity: isLoading ? 0.7 : 1
              }}
            >
              {isLoading ? "Sending..." : "Send Magic Link"}
            </button>
          )}
        </div>

        {/* Toggle between magic link and password */}
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <button
            onClick={() => setUsePassword(!usePassword)}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontSize: "0.875rem",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            {usePassword ? "Use Magic Link instead" : "Use Password instead"}
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div style={{
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius)",
            fontSize: "0.875rem",
            marginBottom: "1rem",
            backgroundColor: message.includes("error") || message.includes("Error") ? "#fef2f2" : "#f0f9ff",
            color: message.includes("error") || message.includes("Error") ? "#dc2626" : "#0369a1",
            border: `1px solid ${message.includes("error") || message.includes("Error") ? "#fecaca" : "#bae6fd"}`
          }}>
            {message}
          </div>
        )}
        
        <p style={{ 
          fontSize: "0.875rem", 
          color: "var(--muted-foreground)", 
          marginTop: "1rem",
          textAlign: "center",
          lineHeight: "1.5"
        }}>
          {usePassword 
            ? "Sign in with your email and password" 
            : "We'll email you a secure link. No password needed."
          }
        </p>
      </div>
    </main>
  );
}
