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

  async function testSessionPersistence() {
    setStatus("Testing session...");
    try {
      const response = await fetch('/api/auth/test-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus(`Session OK: ${data.user.email}`);
        setUser(data.user);
      } else {
        setStatus(`Session Error: ${data.message}`);
      }
    } catch (error: any) {
      setStatus(`Test Error: ${error.message}`);
    }
  }

  async function fixSession() {
    setStatus("Fixing session...");
    try {
      // Get email and password from localStorage or prompt user
      const email = localStorage.getItem('testEmail') || prompt('Enter your email:');
      const password = localStorage.getItem('testPassword') || prompt('Enter your password:');
      
      if (!email || !password) {
        setStatus("Email and password required");
        return;
      }

      // Store credentials for future use
      localStorage.setItem('testEmail', email);
      localStorage.setItem('testPassword', password);

      const response = await fetch('/api/auth/fix-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus(`Session Fixed: ${data.user.email}`);
        setUser(data.user);
        // Reload the page to refresh the session
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatus(`Fix Error: ${data.message}`);
      }
    } catch (error: any) {
      setStatus(`Fix Error: ${error.message}`);
    }
  }

  async function analyzeCookies() {
    setStatus("Analyzing cookies...");
    try {
      const response = await fetch('/api/debug/cookie-deep');
      const data = await response.json();
      
      if (data.status === 'success') {
        const cookieCount = data.cookies.total;
        const supabaseCookies = data.cookies.supabaseCookies.length;
        const sessionExists = data.session.exists;
        
        setStatus(`Cookies: ${cookieCount} total, ${supabaseCookies} Supabase, Session: ${sessionExists ? 'OK' : 'Missing'}`);
        
        // Log detailed info to console
        console.log('Deep Cookie Analysis:', data);
      } else {
        setStatus(`Analysis Error: ${data.message}`);
      }
    } catch (error: any) {
      setStatus(`Analysis Error: ${error.message}`);
    }
  }

  async function setCookiesManually() {
    setStatus("Setting cookies manually...");
    try {
      // Get email and password from localStorage or prompt user
      const email = localStorage.getItem('testEmail') || prompt('Enter your email:');
      const password = localStorage.getItem('testPassword') || prompt('Enter your password:');
      
      if (!email || !password) {
        setStatus("Email and password required");
        return;
      }

      const response = await fetch('/api/auth/set-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setStatus(`Cookies Set: ${data.user.email}`);
        setUser(data.user);
        // Reload the page to refresh the session
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatus(`Set Cookies Error: ${data.message}`);
      }
    } catch (error: any) {
      setStatus(`Set Cookies Error: ${error.message}`);
    }
  }

  async function analyzeSessionTimeline() {
    setStatus("Analyzing session timeline...");
    try {
      const response = await fetch('/api/debug/session-timeline');
      const data = await response.json();
      
      if (data.status === 'success') {
        console.log('Session Timeline Analysis:', data);
        setStatus(`Timeline: ${data.summary.successfulSteps}/${data.summary.totalSteps} steps successful`);
        
        // Log detailed timeline to console
        data.timeline.forEach((step: any) => {
          console.log(`Step ${step.step}: ${step.action} - ${step.status}`, step.details);
        });
      } else {
        setStatus(`Timeline Error: ${data.message}`);
      }
    } catch (error: any) {
      setStatus(`Timeline Error: ${error.message}`);
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
      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
        <button 
          onClick={forceRefresh}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Force Refresh
        </button>
        <button 
          onClick={testSessionPersistence}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Session
        </button>
        <button 
          onClick={fixSession}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Fix Session
        </button>
        <button 
          onClick={analyzeCookies}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Analyze Cookies
        </button>
        <button 
          onClick={setCookiesManually}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Set Cookies
        </button>
        <button 
          onClick={analyzeSessionTimeline}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            background: '#20c997',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Timeline
        </button>
      </div>
    </div>
  );
}
