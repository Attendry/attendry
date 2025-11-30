"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, 
  Target, 
  Bot, 
  Shield, 
  Bell,
  Settings as SettingsIcon,
  ArrowRight,
  Search,
  X
} from 'lucide-react';
import { PageHeader } from '@/components/Layout/PageHeader';
import Link from 'next/link';

type SettingsTab = 'profile' | 'discovery' | 'agents' | 'privacy' | 'notifications';

interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  href: string;
}

const settingsTabs: SettingsTabConfig[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    description: 'Manage your personal information and preferences',
    href: '/settings/profile'
  },
  {
    id: 'discovery',
    label: 'Discovery',
    icon: Target,
    description: 'Configure how we discover events and opportunities for you',
    href: '/settings/discovery'
  },
  {
    id: 'agents',
    label: 'AI Agents',
    icon: Bot,
    description: 'Manage your AI agent team for automated outreach and follow-up',
    href: '/settings/agents'
  },
  {
    id: 'privacy',
    label: 'Privacy & Data',
    icon: Shield,
    description: 'Control your data, privacy settings, and GDPR compliance',
    href: '/settings/privacy'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Configure how and when you receive notifications',
    href: '/settings/notifications'
  },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && settingsTabs.some(t => t.id === tabParam)) {
      setActiveTab(tabParam as SettingsTab);
    }
  }, [searchParams]);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Focus search on "/" key (when not typing in input)
      if (e.key === '/' && e.target instanceof HTMLInputElement === false) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleTabClick = (tab: SettingsTabConfig) => {
    setActiveTab(tab.id);
    router.push(tab.href);
  };

  // Filter settings based on search query
  const filteredTabs = searchQuery.trim()
    ? settingsTabs.filter(tab => 
        tab.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tab.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : settingsTabs;

  // Most used settings (based on common usage patterns)
  const mostUsedSettings = [
    settingsTabs.find(t => t.id === 'discovery'),
    settingsTabs.find(t => t.id === 'notifications'),
    settingsTabs.find(t => t.id === 'profile'),
  ].filter(Boolean) as SettingsTabConfig[];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title="Settings"
          subtitle="Manage your account, preferences, and automation settings"
          breadcrumbs={[{ label: 'Settings' }]}
        />

        {/* Search Bar */}
        <div className="mt-8 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search settings... (Press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Most Used Settings */}
        {!searchQuery && mostUsedSettings.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Most Used
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mostUsedSettings.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    onClick={() => handleTabClick(tab)}
                    className={`group relative p-6 bg-white dark:bg-slate-800 rounded-lg border-2 transition-all hover:shadow-lg ${
                      isActive
                        ? 'border-blue-500 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${
                            isActive
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {tab.label}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {tab.description}
                        </p>
                      </div>
                      <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-1 ${
                        isActive ? 'text-blue-500' : ''
                      }`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* All Settings */}
        <div className={!searchQuery ? 'mt-8' : ''}>
          {!searchQuery && (
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              All Settings
            </h3>
          )}
          {filteredTabs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-slate-600 dark:text-slate-400">
                No settings found matching "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <Link
                key={tab.id}
                href={tab.href}
                onClick={() => handleTabClick(tab)}
                className={`group relative p-6 bg-white dark:bg-slate-800 rounded-lg border-2 transition-all hover:shadow-lg ${
                  isActive
                    ? 'border-blue-500 shadow-md'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {tab.label}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {tab.description}
                    </p>
                  </div>
                  <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform group-hover:translate-x-1 ${
                    isActive ? 'text-blue-500' : ''
                  }`} />
                </div>
              </Link>
            );
          })}
            </div>
          )}
        </div>

        {/* Quick Links Section */}
        <div className="mt-12 p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Quick Links
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Advanced Settings</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Search configuration and templates</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <PageHeader
            title="Settings"
            subtitle="Manage your account, preferences, and automation settings"
            breadcrumbs={[{ label: 'Settings' }]}
          />
          <div className="mt-8 flex items-center justify-center py-12">
            <p className="text-slate-600 dark:text-slate-400">Loading settings...</p>
          </div>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
