"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export function AuthHelper() {
  const [status, setStatus] = useState<string>("Checking...");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const supabase = supabaseBrowser();
      
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus(`Error: ${error.message}`);
        return;
      }

      if (session) {
        setUser(session.user);
        setStatus(`Authenticated as: ${session.user.email}`);
        
        // Try to force refresh the session
        try {
          await supabase.auth.refreshSession({
            refresh_token: session.refresh_token
          });
          setStatus(`Session refreshed for: ${session.user.email}`);
        } catch (refreshError) {
          console.error('Refresh error:', refreshError);
        }
      } else {
        setStatus("Not authenticated");
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    }
  }

  async function forceRefresh() {
    setStatus("Refreshing...");
    try {
      const response = await fetch('/api/auth/force-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus(`Success: ${data.message}`);
        setUser(data.user);
        // Reload the page to refresh the session
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatus(`Error: ${data.message}`);
      }
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'white',
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '12px',
      zIndex: 1000,
      maxWidth: '300px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div><strong>Auth Status:</strong> {status}</div>
      {user && (
        <div><strong>User:</strong> {user.email}</div>
      )}
      <button 
        onClick={forceRefresh}
        style={{
          marginTop: '8px',
          padding: '4px 8px',
          fontSize: '11px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Force Refresh Session
      </button>
    </div>
  );
}
