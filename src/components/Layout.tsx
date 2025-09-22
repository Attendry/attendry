"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import Link from "next/link";
import { usePathname } from "next/navigation";

type UserLite = { id: string; email?: string | null };

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [user, setUser] = useState<UserLite | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();

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

  const navigationItems = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/events", label: "Events", icon: "📅" },
    { href: "/watchlist", label: "Watchlist", icon: "⭐" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Responsive Sidebar */}
      <aside className="w-16 lg:w-64 bg-white border-r border-gray-200 shadow-sm flex-shrink-0 transition-all duration-300">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center lg:justify-start border-b border-gray-200 h-16 px-3 lg:px-6">
            <Link 
              href="/" 
              className="text-lg lg:text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
              title="Attendry"
            >
              <span className="lg:hidden">A</span>
              <span className="hidden lg:inline">Attendry</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 space-y-2 px-2 lg:px-4">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
                title={item.label}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            ))}

            {/* Admin link - only show if user is authenticated */}
            {authReady && user && (
              <Link
                href="/admin"
                className={`flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-2 lg:px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive('/admin')
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
                title="Admin"
              >
                <span className="text-lg">⚙️</span>
                <span className="hidden lg:inline">Admin</span>
              </Link>
            )}
          </nav>

          {/* User Profile Section */}
          {authReady && user && (
            <div className="border-t border-gray-200 p-2 lg:p-4">
              <div className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden lg:block flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {user.email?.split('@')[0] || `User ${user.id.slice(0, 6)}`}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {user.email || 'No email'}
                  </div>
                </div>
                <button
                  onClick={() => supabaseBrowser().auth.signOut()}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Sign out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {authReady && !user && (
            <div className="border-t border-gray-200 p-2 lg:p-4">
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-0 lg:gap-2 px-2 lg:px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                title="Sign in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="hidden lg:inline">Sign in</span>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
