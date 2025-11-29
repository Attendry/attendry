'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Home, 
  Calendar, 
  Bell, 
  Settings,
  X,
  Menu,
  Target,
  Users,
  LayoutGrid,
  Activity,
  TrendingUp
} from 'lucide-react';

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
}

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  const pathname = usePathname();

  // Match sidebar structure - clean, non-duplicative
  const navigationItems: NavigationItem[] = [
    { href: '/dashboard', label: 'Home', icon: Home },
    { href: '/opportunities', label: 'Opportunities', icon: Target },
    { href: '/events', label: 'Events', icon: Calendar },
    { href: '/contacts', label: 'Contacts', icon: Users },
    { href: '/events-board', label: 'Events Board', icon: LayoutGrid },
    { href: '/trending', label: 'Insights', icon: TrendingUp },
    { href: '/activity', label: 'Activity', icon: Activity },
    { href: '/notifications', label: 'Notifications', icon: Bell, badge: 3 },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Mobile Menu */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-50 lg:hidden">
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-700">
          <Link 
            href="/" 
            className="font-bold text-xl text-slate-900 dark:text-white"
            onClick={onClose}
          >
            Attendry
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                    transition-colors duration-200
                    ${isActive(item.href)
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-r-2 border-blue-700 dark:border-blue-400'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }
                  `}
                >
                  <item.icon 
                    size={20} 
                    className={`
                      flex-shrink-0
                      ${isActive(item.href) 
                        ? 'text-blue-700 dark:text-blue-400' 
                        : 'text-slate-500 dark:text-slate-400'
                      }
                    `}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
            v2.0 • Premium
          </div>
        </div>
      </div>
    </>
  );
}

// Mobile menu button component
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label="Open menu"
    >
      <Menu size={20} />
    </button>
  );
}
