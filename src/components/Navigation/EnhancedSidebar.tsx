'use client';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Home, 
  Calendar, 
  Search, 
  Brain, 
  BarChart3, 
  Bell, 
  Settings,
  ChevronLeft, 
  ChevronRight,
  Bookmark,
  Activity,
  TrendingUp,
  CalendarDays,
  LayoutGrid,
  Sun,
  Moon,
  Contrast,
  User
} from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase-browser';

type UserLite = { id: string; email?: string | null };
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
  description?: string;
  children?: NavigationItem[];
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

interface EnhancedSidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  // Feature flags
  enableAuth?: boolean;
  enableThemeSwitcher?: boolean;
  enableAdminSection?: boolean;
  // Theme control
  theme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
  // Custom navigation (optional - uses default if not provided)
  navigationItems?: NavigationItem[];
  navigationGroups?: NavigationGroup[];
}

const defaultNavigationItems: NavigationItem[] = [
  { href: '/dashboard', label: 'Command Centre', icon: Home },
  { 
    href: '/events', 
    label: 'Events', 
    icon: Calendar,
    children: [
      { href: '/events', label: 'All Events', icon: Calendar },
      { href: '/events-board', label: 'Events Board', icon: LayoutGrid },
      { href: '/watchlist', label: 'My Watchlist', icon: Bookmark },
      { href: '/calendar', label: 'Relevant Events', icon: CalendarDays }
    ]
  },
  { href: '/search', label: 'Search', icon: Search },
  { 
    href: '/recommendations', 
    label: 'Market Intelligence', 
    icon: Brain,
    children: [
      { href: '/recommendations', label: 'Event Recommendations', icon: Brain },
      { href: '/trending', label: 'Trend Insights', icon: TrendingUp }
    ]
  },
  { href: '/activity', label: 'Insights', icon: BarChart3 },
  { href: '/notifications', label: 'Notifications', icon: Bell, badge: 3 },
  { href: '/settings', label: 'Settings', icon: Settings }
];

const defaultNavigationGroups: NavigationGroup[] = [
  {
    label: "Hero Hub",
    items: [
      { href: "/dashboard", label: "Command Centre", icon: Home },
      { href: "/events", label: "Event Hub", icon: Calendar },
      { href: "/events-board", label: "Events Board", icon: LayoutGrid },
      { href: "/watchlist", label: "Watchlist", icon: Bookmark },
      { href: "/activity", label: "Event Insights", icon: BarChart3 },
      { href: "/recommendations", label: "Market Intelligence", icon: TrendingUp },
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
];

const adminGroup: NavigationGroup = {
  label: "Admin & Health",
  items: [
    { href: "/admin", label: "Admin Dashboard", icon: Settings },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/health", label: "System Health", icon: Activity },
  ],
};

const themeOptions: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'high-contrast', label: 'High Contrast', icon: Contrast },
];

export const EnhancedSidebar = memo(function EnhancedSidebar({
  isCollapsed = false,
  onToggle,
  enableAuth = false,
  enableThemeSwitcher = false,
  enableAdminSection = false,
  theme: controlledTheme,
  onThemeChange,
  navigationItems: customNavigationItems,
  navigationGroups: customNavigationGroups,
}: EnhancedSidebarProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(isCollapsed);
  const [user, setUser] = useState<UserLite | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [internalTheme, setInternalTheme] = useState<ThemeMode>('light');
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  // Use controlled theme if provided, otherwise use internal state
  const theme = controlledTheme ?? internalTheme;
  const setTheme = useCallback((newTheme: ThemeMode) => {
    if (onThemeChange) {
      onThemeChange(newTheme);
    } else {
      setInternalTheme(newTheme);
    }
  }, [onThemeChange]);

  // Auto-detect system theme preference
  useEffect(() => {
    if (!controlledTheme && !onThemeChange) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setInternalTheme(mediaQuery.matches ? 'dark' : 'light');

      const handleChange = (e: MediaQueryListEvent) => {
        setInternalTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [controlledTheme, onThemeChange]);

  // Auth integration
  useEffect(() => {
    if (!enableAuth) return;

    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data.session?.user ?? null);
        setAuthReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [enableAuth]);

  // Memoized navigation items
  const navigationItems = useMemo(() => 
    customNavigationItems ?? defaultNavigationItems,
    [customNavigationItems]
  );

  const navigationGroups = useMemo(() => 
    customNavigationGroups ?? defaultNavigationGroups,
    [customNavigationGroups]
  );

  // Memoized flattened items for keyboard navigation
  const flattenedItems = useMemo(() => 
    navigationItems.flatMap(item => 
      item.children ? [item, ...item.children] : [item]
    ),
    [navigationItems]
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && onToggle) {
      onToggle();
    }
    
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      
      if (e.key === 'ArrowDown') {
        setFocusedIndex(prev => (prev + 1) % flattenedItems.length);
      } else {
        setFocusedIndex(prev => (prev - 1 + flattenedItems.length) % flattenedItems.length);
      }
    }
  }, [onToggle, flattenedItems.length]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const isActive = useCallback((href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }, [pathname]);

  useEffect(() => {
    setIsManuallyCollapsed(isCollapsed);
  }, [isCollapsed]);

  const shouldShowExpanded = !isManuallyCollapsed || isHovered;

  // Apply theme to document root for high-contrast, or use dark class for dark mode
  useEffect(() => {
    if (!enableThemeSwitcher) return;
    
    const root = document.documentElement;
    if (theme === 'high-contrast') {
      root.classList.remove('dark');
      root.classList.add('high-contrast');
    } else if (theme === 'dark') {
      root.classList.remove('high-contrast');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark', 'high-contrast');
    }
  }, [theme, enableThemeSwitcher]);

  const themeClasses = {
    light: 'bg-white border-slate-200 text-slate-900',
    dark: 'bg-slate-900 border-slate-700 text-white',
    'high-contrast': 'bg-black border-slate-600 text-white',
  };

  const themeTextClasses = {
    light: {
      primary: 'text-slate-900',
      secondary: 'text-slate-700',
      muted: 'text-slate-500',
      hover: 'hover:text-slate-900',
    },
    dark: {
      primary: 'text-white',
      secondary: 'text-slate-300',
      muted: 'text-slate-400',
      hover: 'hover:text-white',
    },
    'high-contrast': {
      primary: 'text-white',
      secondary: 'text-slate-200',
      muted: 'text-slate-300',
      hover: 'hover:text-white',
    },
  };

  const currentThemeClasses = themeTextClasses[theme];

  return (
    <aside 
      ref={sidebarRef}
      className={`
        fixed left-0 top-0 h-screen ${themeClasses[theme]}
        border-r z-50
        transition-all duration-300 ease-in-out
        ${shouldShowExpanded ? 'w-64' : 'w-16'}
        lg:static lg:z-auto
      `}
      role="navigation"
      aria-label="Main navigation"
      onMouseEnter={() => {
        if (isManuallyCollapsed) {
          setIsHovered(true);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className={`flex items-center h-16 px-4 border-b ${shouldShowExpanded ? 'justify-between' : 'justify-center'} ${
        theme === 'dark' ? 'border-slate-700' : theme === 'high-contrast' ? 'border-slate-600' : 'border-slate-200'
      }`}>
        {shouldShowExpanded ? (
          <Link 
            href="/" 
            className={`font-bold text-xl ${currentThemeClasses.primary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}
          >
            Attendry
          </Link>
        ) : (
          <Link 
            href="/" 
            className={`font-bold text-lg ${currentThemeClasses.primary} hover:text-blue-600 dark:hover:text-blue-400 transition-colors`}
            title="Attendry"
          >
            A
          </Link>
        )}
        <button
          onClick={() => {
            setIsManuallyCollapsed(!isManuallyCollapsed);
            onToggle?.();
          }}
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' 
              ? 'hover:bg-slate-800' 
              : theme === 'high-contrast'
              ? 'hover:bg-slate-900'
              : 'hover:bg-slate-100'
          }`}
          aria-label={isManuallyCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isManuallyCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" role="navigation">
        {customNavigationGroups ? (
          // Grouped navigation mode
          <div className="space-y-6 px-2 lg:px-4">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                {shouldShowExpanded && (
                  <div className="px-4 mb-2">
                    <h3 className={`text-xs font-semibold uppercase tracking-wider ${
                      theme === 'dark' ? 'text-slate-400' : theme === 'high-contrast' ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {group.label}
                    </h3>
                  </div>
                )}
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`
                            flex items-center rounded-lg text-sm font-medium transition-all duration-200
                            ${shouldShowExpanded ? 'justify-start px-4 py-3 gap-3' : 'justify-center px-2 py-3'}
                            ${active
                              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-400'
                              : `${currentThemeClasses.secondary} ${currentThemeClasses.hover} ${
                                  theme === 'dark' 
                                    ? 'hover:bg-slate-800' 
                                    : theme === 'high-contrast'
                                    ? 'hover:bg-slate-900'
                                    : 'hover:bg-slate-50'
                                }`
                            }
                          `}
                          title={!shouldShowExpanded ? item.label : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.8} />
                          {shouldShowExpanded && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {/* Admin Section */}
            {enableAdminSection && authReady && user && shouldShowExpanded && (
              <div>
                <div className="px-4 mb-2">
                  <h3 className={`text-xs font-semibold uppercase tracking-wider ${
                    theme === 'dark' ? 'text-slate-400' : theme === 'high-contrast' ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {adminGroup.label}
                  </h3>
                </div>
                <ul className="space-y-1">
                  {adminGroup.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`
                            flex items-center rounded-lg text-sm font-medium transition-all duration-200
                            ${shouldShowExpanded ? 'justify-start px-4 py-3 gap-3' : 'justify-center px-2 py-3'}
                            ${active
                              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-400'
                              : `${currentThemeClasses.secondary} ${currentThemeClasses.hover} ${
                                  theme === 'dark' 
                                    ? 'hover:bg-slate-800' 
                                    : theme === 'high-contrast'
                                    ? 'hover:bg-slate-900'
                                    : 'hover:bg-slate-50'
                                }`
                            }
                          `}
                          title={!shouldShowExpanded ? item.label : undefined}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.8} />
                          {shouldShowExpanded && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : (
          // Flat navigation mode with nested children
          <ul className="space-y-1 px-2">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200 group
                    ${isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-r-2 border-blue-700 dark:border-blue-400'
                      : `${currentThemeClasses.secondary} ${
                          theme === 'dark' 
                            ? 'hover:bg-slate-800' 
                            : theme === 'high-contrast'
                            ? 'hover:bg-slate-900'
                            : 'hover:bg-slate-100'
                        }`
                    }
                    ${shouldShowExpanded ? 'justify-start' : 'justify-center'}
                  `}
                  title={!shouldShowExpanded ? item.label : undefined}
                >
                  <item.icon 
                    size={20} 
                    className={`
                      flex-shrink-0
                      ${isActive(item.href) 
                        ? 'text-blue-700 dark:text-blue-400' 
                        : `${currentThemeClasses.muted} ${
                            theme === 'dark' 
                              ? 'group-hover:text-slate-300' 
                              : 'group-hover:text-slate-700'
                          }`
                      }
                    `}
                  />
                  {shouldShowExpanded ? (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </>
                  ) : (
                    item.badge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {item.badge}
                      </span>
                    )
                  )}
                </Link>
                
                {/* Sub-navigation (only show when expanded) */}
                {shouldShowExpanded && item.children && (
                  <ul className="ml-6 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                            transition-colors duration-200
                            ${isActive(child.href)
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                              : `${currentThemeClasses.muted} ${
                                  theme === 'dark' 
                                    ? 'hover:bg-slate-800' 
                                    : theme === 'high-contrast'
                                    ? 'hover:bg-slate-900'
                                    : 'hover:bg-slate-50'
                                }`
                            }
                          `}
                        >
                          <child.icon size={14} />
                          <span className="truncate">{child.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Theme Switcher */}
      {enableThemeSwitcher && shouldShowExpanded && (
        <div className={`p-4 border-t ${
          theme === 'dark' ? 'border-slate-700' : theme === 'high-contrast' ? 'border-slate-600' : 'border-slate-200'
        }`}>
          <div className="mb-3">
            <h3 className={`text-xs font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-400' : theme === 'high-contrast' ? 'text-slate-300' : 'text-slate-600'
            }`}>
              Theme
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className={`
                      p-2 rounded-lg transition-colors
                      ${isActive
                        ? theme === 'dark'
                          ? 'bg-blue-600 text-white'
                          : theme === 'high-contrast'
                          ? 'bg-blue-500 text-white'
                          : 'bg-blue-100 text-blue-700'
                        : theme === 'dark'
                        ? 'hover:bg-slate-700 text-slate-400'
                        : theme === 'high-contrast'
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100 text-slate-600'
                      }
                    `}
                    title={option.label}
                    aria-label={`Switch to ${option.label} theme`}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* User Profile (if auth enabled) */}
      {enableAuth && authReady && user && shouldShowExpanded && (
        <div className={`p-4 border-t ${
          theme === 'dark' ? 'border-slate-700' : theme === 'high-contrast' ? 'border-slate-600' : 'border-slate-200'
        }`}>
          <div className={`flex items-center space-x-3 p-3 rounded-lg ${
            theme === 'dark' 
              ? 'bg-slate-800' 
              : theme === 'high-contrast'
              ? 'bg-slate-900'
              : 'bg-slate-50'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              theme === 'dark' 
                ? 'bg-blue-600' 
                : theme === 'high-contrast'
                ? 'bg-blue-500'
                : 'bg-blue-100'
            }`}>
              <User size={16} className={
                theme === 'dark' || theme === 'high-contrast' 
                  ? 'text-white' 
                  : 'text-blue-600'
              } />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${
                theme === 'dark' ? 'text-white' : theme === 'high-contrast' ? 'text-white' : 'text-slate-900'
              }`}>
                {user.email?.split('@')[0] || 'User'}
              </p>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-slate-400' : theme === 'high-contrast' ? 'text-slate-300' : 'text-slate-500'
              }`}>
                Event Discovery
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {shouldShowExpanded && (
        <div className={`p-4 border-t ${
          theme === 'dark' ? 'border-slate-700' : theme === 'high-contrast' ? 'border-slate-600' : 'border-slate-200'
        }`}>
          <div className={`text-xs text-center ${
            theme === 'dark' ? 'text-slate-400' : theme === 'high-contrast' ? 'text-slate-300' : 'text-slate-500'
          }`}>
            v2.0 • Premium
          </div>
        </div>
      )}
    </aside>
  );
});

