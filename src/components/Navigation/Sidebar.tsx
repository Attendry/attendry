'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  LayoutGrid,
  Users,
  Target
} from 'lucide-react';

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
}

interface NavigationSection {
  label?: string;
  items: NavigationItem[];
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
  const router = useRouter();
  const sidebarRef = useRef<HTMLElement>(null);

  // Clean, non-duplicative navigation organized by priority
  const navigationSections: NavigationSection[] = [
    {
      label: 'Primary',
      items: [
        { href: '/dashboard', label: 'Home', icon: Home },
        { href: '/opportunities', label: 'Opportunities', icon: Target },
        { href: '/events', label: 'Events', icon: Calendar },
        { href: '/contacts', label: 'Contacts', icon: Users },
      ],
    },
    {
      label: 'Secondary',
      items: [
        { href: '/events-board', label: 'Events Board', icon: LayoutGrid },
        { href: '/trending', label: 'Insights', icon: TrendingUp },
        { href: '/activity', label: 'Activity', icon: Activity },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/notifications', label: 'Notifications', icon: Bell, badge: 3 },
        { href: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  // Flatten for keyboard navigation
  const allNavigationItems = navigationSections.flatMap(section => section.items);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle keyboard navigation if sidebar or a link within sidebar is focused
    const activeElement = document.activeElement;
    const isSidebarFocused = sidebarRef.current?.contains(activeElement) || 
                              activeElement?.closest('aside[role="navigation"]') !== null;
    
    if (!isSidebarFocused) {
      return; // Don't interfere with other components
    }

    if (e.key === 'Escape' && onToggle) {
      onToggle();
    }
    
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.key === 'ArrowDown') {
        setFocusedIndex(prev => (prev + 1) % allNavigationItems.length);
      } else {
        setFocusedIndex(prev => (prev - 1 + allNavigationItems.length) % allNavigationItems.length);
      }
    }
  }, [onToggle, allNavigationItems]);

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
        fixed left-0 top-0 h-screen bg-white dark:bg-slate-900 
        border-r border-slate-200 dark:border-slate-700 z-[100]
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
      <div className={`flex items-center h-16 px-4 border-b border-slate-200 dark:border-slate-700 ${shouldShowExpanded ? 'justify-between' : 'justify-center'}`}>
        {shouldShowExpanded ? (
          <Link 
            href="/" 
            className="font-bold text-xl text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Attendry
          </Link>
        ) : (
          <Link 
            href="/" 
            className="font-bold text-lg text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={isManuallyCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isManuallyCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto" role="navigation">
        <div className="space-y-6 px-2">
          {navigationSections.map((section, sectionIndex) => (
            <div key={section.label || sectionIndex}>
              {/* Section Header (only show when expanded) */}
              {shouldShowExpanded && section.label && (
                <div className="mb-2 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {section.label}
                  </span>
                </div>
              )}
              
              {/* Section Items */}
              <ul className="space-y-1">
                {section.items.map((item, itemIndex) => {
                  const globalIndex = navigationSections
                    .slice(0, sectionIndex)
                    .reduce((sum, s) => sum + s.items.length, 0) + itemIndex;
                  const isFocused = focusedIndex === globalIndex;
                  
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={(e) => {
                          // Ensure navigation works even if Link is blocked
                          // This is a fallback to ensure clicks always work
                          const target = e.currentTarget;
                          if (target.getAttribute('aria-disabled') === 'true') {
                            e.preventDefault();
                            return;
                          }
                          // Let Link handle navigation normally, but ensure it works
                          router.prefetch(item.href);
                        }}
                        className={`
                          relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                          transition-all duration-200 group
                          ${isActive(item.href)
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-r-2 border-blue-700 dark:border-blue-400'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }
                          ${shouldShowExpanded ? 'justify-start' : 'justify-center'}
                          ${isFocused ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                        `}
                        title={!shouldShowExpanded ? item.label : undefined}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <item.icon 
                          size={20} 
                          className={`
                            flex-shrink-0
                            ${isActive(item.href) 
                              ? 'text-blue-700 dark:text-blue-400' 
                              : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300'
                            }
                          `}
                        />
                        {shouldShowExpanded ? (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            )}
                          </>
                        ) : (
                          item.badge !== undefined && item.badge > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      {shouldShowExpanded && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
            v2.0 • Premium
          </div>
        </div>
      )}
    </aside>
  );
}
