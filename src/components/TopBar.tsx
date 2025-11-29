"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { usePathname } from "next/navigation";
import { AgentNotifications } from "@/components/agents/AgentNotifications";

type UserLite = { id: string; email?: string | null };

interface TopBarProps {
  onMenuClick: () => void;
  mobileMenuButton?: React.ReactNode;
}

export function TopBar({ onMenuClick, mobileMenuButton }: TopBarProps) {
  const [user, setUser] = useState<UserLite | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const pageTitle = useMemo(() => {
    const mapping = [
      { path: "/dashboard", label: "Command Centre" },
      { path: "/recommendations", label: "Intelligence" },
      { path: "/events", label: "Speaker Search" },
      { path: "/events-board", label: "Events Board" },
      { path: "/watchlist", label: "Contacts" },
      { path: "/activity", label: "Reporting" },
      { path: "/notifications", label: "Alerts" },
      { path: "/admin", label: "Admin" },
    ];

    const match = mapping.find((entry) => pathname.startsWith(entry.path));
    return match?.label ?? "Dashboard";
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const supabase = supabaseBrowser();

    // Get current session
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data.session?.user ?? null);
        setAuthReady(true);
      }
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Handle window resize to detect sidebar collapse state
  useEffect(() => {
    function handleResize() {
      if (typeof window !== 'undefined') {
        const isSmallScreen = window.innerWidth < 1280; // xl breakpoint
        setIsCollapsed(isSmallScreen);
      }
    }

    // Set initial state
    handleResize();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    if (showUserMenu && typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-4 lg:px-6 h-16">
      <div className="flex items-center justify-between h-full">
        {/* Mobile menu button */}
        {mobileMenuButton || (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open navigation menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        {/* Desktop title - hidden on mobile */}
        <div className="hidden lg:block">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{pageTitle}</h1>
        </div>

        {/* Right side - Profile and Sign out */}
        <div className="flex items-center gap-4">
          {authReady && user && (
            <>
              {/* Agent Notifications */}
              <AgentNotifications />
              {/* Profile button */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Profile"
                >
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:inline">Profile</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* User dropdown menu */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
                    <div className="p-3">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {user.email?.split('@')[0] || `User ${user.id.slice(0, 6)}`}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {user.email || 'No email'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          supabaseBrowser().auth.signOut();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors mt-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {authReady && !user && (
            <a
              href="/login"
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sign in</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
