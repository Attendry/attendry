'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Briefcase,
  CalendarDays
} from 'lucide-react';

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
  children?: NavigationItem[];
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(isCollapsed);
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLElement>(null);

  const navigationItems: NavigationItem[] = [
    { href: '/dashboard', label: 'Command Centre', icon: Home },
    { 
      href: '/events', 
      label: 'Events', 
      icon: Calendar,
      children: [
        { href: '/events', label: 'All Events', icon: Calendar },
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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && onToggle) {
      onToggle();
    }
    
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = navigationItems.flatMap(item => 
        item.children ? [item, ...item.children] : [item]
      );
      
      if (e.key === 'ArrowDown') {
        setFocusedIndex(prev => (prev + 1) % items.length);
      } else {
        setFocusedIndex(prev => (prev - 1 + items.length) % items.length);
      }
    }
  }, [onToggle, navigationItems]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // Update manual collapse state when prop changes
  useEffect(() => {
    setIsManuallyCollapsed(isCollapsed);
  }, [isCollapsed]);

  const shouldShowExpanded = !isManuallyCollapsed || isHovered;

  return (
    <aside 
      ref={sidebarRef}
      className={`
        fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 
        border-r border-gray-200 dark:border-gray-700 z-50
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
      <div className={`flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700 ${shouldShowExpanded ? 'justify-between' : 'justify-center'}`}>
        {shouldShowExpanded ? (
          <Link 
            href="/" 
            className="font-bold text-xl text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Attendry
          </Link>
        ) : (
          <Link 
            href="/" 
            className="font-bold text-lg text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={isManuallyCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isManuallyCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" role="navigation">
        <ul className="space-y-1 px-2">
          {navigationItems.map((item, index) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`
                  relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200 group
                  ${isActive(item.href)
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-r-2 border-blue-700 dark:border-blue-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
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
                      : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300'
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
                            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
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
      </nav>

      {/* Footer */}
      {shouldShowExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            v2.0 • Premium
          </div>
        </div>
      )}
    </aside>
  );
}
