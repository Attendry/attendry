'use client';

import { motion } from 'framer-motion';
import { Menu, Bell, Search, User } from 'lucide-react';
import { memo, useMemo, useCallback } from 'react';
import { useAdaptive } from './AdaptiveDashboard';

const Topbar = memo(() => {
  const { 
    setSidebarCollapsed, 
    currentModule, 
    theme,
    userBehavior 
  } = useAdaptive();

  // Memoized module title and description
  const { moduleTitle, moduleDescription } = useMemo(() => {
    const titles = {
      search: 'Event Search',
      recommendations: 'Recommendations',
      trending: 'Trending Events',
      compare: 'Compare Events',
      insights: 'Insights',
    };

    const descriptions = {
      search: 'Find conferences, meetups, and networking opportunities',
      recommendations: 'Personalized event recommendations based on your interests',
      trending: 'Discover what\'s popular and trending in your industry',
      compare: 'Compare events side-by-side to make informed decisions',
      insights: 'AI-powered insights about your event discovery patterns',
    };

    return {
      moduleTitle: titles[currentModule] || 'Event Discovery',
      moduleDescription: descriptions[currentModule] || 'AI-Powered Event Discovery Platform',
    };
  }, [currentModule]);

  // Memoized event handlers
  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(false);
  }, [setSidebarCollapsed]);

  return (
    <motion.header
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`border-b transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-800 border-slate-700' 
          : theme === 'high-contrast'
          ? 'bg-slate-900 border-slate-600'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSidebarToggle}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'hover:bg-slate-700 text-slate-300' 
                  : theme === 'high-contrast'
                  ? 'hover:bg-slate-800 text-white'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Menu size={20} />
            </button>
            
            <div>
              <h1 className={`text-xl font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                {moduleTitle}
              </h1>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {moduleDescription}
              </p>
            </div>
          </div>

          {/* Center - Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search 
                size={20} 
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`} 
              />
              <input
                type="text"
                placeholder="Search..."
                className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500'
                    : theme === 'high-contrast'
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-400 focus:border-blue-400'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-500'
                }`}
              />
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            {/* Activity indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                userBehavior.idleTime > 10000 
                  ? 'bg-yellow-500' 
                  : userBehavior.searchCount > 0 || userBehavior.eventClicks > 0
                  ? 'bg-green-500'
                  : 'bg-slate-400'
              }`} />
              <span className={`text-xs ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {userBehavior.idleTime > 10000 ? 'Idle' : 'Discovering'}
              </span>
            </div>

            {/* Notifications */}
            <button
              className={`p-2 rounded-lg transition-colors relative ${
                theme === 'dark' 
                  ? 'hover:bg-slate-700 text-slate-300' 
                  : theme === 'high-contrast'
                  ? 'hover:bg-slate-800 text-white'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>

            {/* User menu */}
            <button
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' 
                  ? 'hover:bg-slate-700 text-slate-300' 
                  : theme === 'high-contrast'
                  ? 'hover:bg-slate-800 text-white'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <User size={20} />
            </button>
          </div>
        </div>
      </div>
    </motion.header>
  );
});

Topbar.displayName = 'Topbar';

export { Topbar };
