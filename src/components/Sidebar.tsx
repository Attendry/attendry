"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { usePathname } from "next/navigation";

type UserLite = { id: string; email?: string | null };

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [user, setUser] = useState<UserLite | null>(null);
  const [authReady, setAuthReady] = useState(false);
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
    { href: "/search", label: "Smart Search", icon: "🔍" },
    { href: "/recommendations", label: "Recommendations", icon: "💡" },
    { href: "/trending", label: "Trending", icon: "🔥" },
    { href: "/compare", label: "Compare Events", icon: "⚖️" },
    { href: "/predictions", label: "Predictions", icon: "🔮" },
    { href: "/watchlist", label: "Watchlist", icon: "⭐" },
    { href: "/profile", label: "Profile", icon: "👤" },
    { href: "/activity", label: "Activity", icon: "📊" },
    { href: "/notifications", label: "Notifications", icon: "🔔" },
  ];

  const adminItems = [
    { href: "/admin", label: "Admin Dashboard", icon: "⚙️" },
    { href: "/admin/analytics", label: "Analytics", icon: "📈" },
    { href: "/admin/health", label: "System Health", icon: "🏥" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay - only show on mobile when sidebar is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-50
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto lg:h-screen
        shadow-lg lg:shadow-none
        overflow-y-auto
        flex-shrink-0
        w-16 lg:w-64
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 h-16 px-3 lg:px-6">
            <Link 
              href="/" 
              className="font-bold text-gray-900 hover:text-blue-600 transition-colors text-lg lg:text-xl"
              onClick={onClose}
              title="Attendry"
            >
              <span className="lg:hidden">A</span>
              <span className="hidden lg:inline">Attendry</span>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 space-y-2 px-2 lg:px-4">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center rounded-lg text-sm font-medium transition-all duration-200
                  justify-center lg:justify-start px-2 lg:px-4 py-3 lg:gap-3
                  ${isActive(item.href)
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                title={item.label}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            ))}

            {/* Admin section - only show if user is authenticated */}
            {authReady && user && (
              <>
                <div className="border-t border-gray-200 my-4"></div>
                <div className="px-2 lg:px-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:block mb-2">
                    Admin
                  </h3>
                </div>
                {adminItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`
                      flex items-center rounded-lg text-sm font-medium transition-all duration-200
                      justify-center lg:justify-start px-2 lg:px-4 py-3 lg:gap-3
                      ${isActive(item.href)
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    title={item.label}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                ))}
              </>
            )}
          </nav>

        </div>
      </aside>
    </>
  );
}
