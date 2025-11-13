"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  Briefcase,
  Calendar,
  CalendarDays,
  House,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";

type UserLite = { id: string; email?: string | null };

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof House;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

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

  const navigationGroups = useMemo<NavigationGroup[]>(
    () => [
      {
        label: "Hero Hub",
        items: [
          { href: "/dashboard", label: "Command Centre", icon: House },
          { href: "/events", label: "Event Hub", icon: Calendar },
          { href: "/watchlist", label: "Watchlist", icon: Bookmark },
          { href: "/activity", label: "Event Insights", icon: BarChart3 },
          {
            href: "/recommendations",
            label: "Market Intelligence",
            icon: TrendingUp,
          },
          { href: "/notifications", label: "Alerts", icon: Bell },
        ],
      },
      {
        label: "Discover Pipeline",
        items: [
          { href: "/search", label: "Smart Search", icon: Search },
          { href: "/calendar", label: "Relevant Events", icon: CalendarDays },
        ],
      },
    ],
    []
  );

  const adminGroup = useMemo<NavigationGroup>(
    () => ({
      label: "Admin & Health",
      items: [
        { href: "/admin", label: "Admin Dashboard", icon: Settings },
        { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { href: "/admin/health", label: "System Health", icon: Activity },
      ],
    }),
    []
  );

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
        fixed left-0 top-0 h-screen bg-white border-r border-slate-200 z-50
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
          <div className="flex items-center justify-between border-b border-slate-200 h-16 px-3 lg:px-6">
            <Link 
              href="/" 
              className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-lg lg:text-xl"
              onClick={onClose}
              title="Attendry"
            >
              <span className="lg:hidden">A</span>
              <span className="hidden lg:inline">Attendry</span>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 space-y-6 px-2 lg:px-4">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <div className="hidden lg:flex items-center justify-between px-4 mb-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </h3>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`
                          flex items-center rounded-lg text-sm font-medium transition-all duration-200
                          justify-center lg:justify-start px-2 lg:px-4 py-3 lg:gap-3
                          ${isActive(item.href)
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                        title={item.label}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                        <span className="hidden lg:inline">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {authReady && user && (
              <div>
                <div className="hidden lg:flex items-center justify-between px-4 mb-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {adminGroup.label}
                  </h3>
                </div>
                <div className="space-y-1">
                  {adminGroup.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`
                          flex items-center rounded-lg text-sm font-medium transition-all duration-200
                          justify-center lg:justify-start px-2 lg:px-4 py-3 lg:gap-3
                          ${isActive(item.href)
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                        title={item.label}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                        <span className="hidden lg:inline">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

        </div>
      </aside>
    </>
  );
}
