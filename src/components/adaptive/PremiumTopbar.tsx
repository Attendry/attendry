'use client';

import { motion } from 'framer-motion';
import { memo, useMemo, useCallback } from 'react';
import { Menu, Search, Bell, User, ChevronDown } from 'lucide-react';
import { useAdaptive } from './PremiumAdaptiveDashboard';

const PremiumTopbar = memo(() => {
  const { 
    setSidebarCollapsed, 
    currentModule, 
    theme,
    userBehavior 
  } = useAdaptive();

  // Memoized module title and description
  const { moduleTitle, moduleDescription, moduleIcon } = useMemo(() => {
    const moduleData = {
      search: {
        title: 'Event Search',
        description: 'Find conferences, meetups, and networking opportunities',
        icon: '🔍'
      },
      recommendations: {
        title: 'Recommendations',
        description: 'Personalized event recommendations based on your interests',
        icon: '💡'
      },
      trending: {
        title: 'Trending Events',
        description: 'Discover what\'s popular and trending in your industry',
        icon: '📈'
      },
      compare: {
        title: 'Compare Events',
        description: 'Compare events side-by-side to make informed decisions',
        icon: '⚖️'
      },
      insights: {
        title: 'Insights',
        description: 'AI-powered insights about your event discovery patterns',
        icon: '🧠'
      },
    };

    return {
      moduleTitle: moduleData[currentModule]?.title || 'Event Discovery',
      moduleDescription: moduleData[currentModule]?.description || 'AI-Powered Event Discovery Platform',
      moduleIcon: moduleData[currentModule]?.icon || '🎯'
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
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="h-16 bg-[#1A1F2C] border-b border-[#2D3344] flex items-center px-6"
    >
      <div className="flex items-center justify-between w-full">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handleSidebarToggle}
            className="p-2 rounded-xl hover:bg-[#2D3344] transition-colors duration-150"
          >
            <Menu size={20} className="text-[#9CA3AF]" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#2D3344] rounded-xl flex items-center justify-center">
              <span className="text-lg">{moduleIcon}</span>
            </div>
            <div>
              <h1 className="text-[#E6E8EC] font-semibold text-lg tracking-tight">
                {moduleTitle}
              </h1>
              <p className="text-[#9CA3AF] text-sm">
                {moduleDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Center - Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search 
              size={18} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9CA3AF]" 
            />
            <input
              type="text"
              placeholder="Search events, locations, topics..."
              className="w-full pl-10 pr-4 py-3 bg-[#0B0F1A] border border-[#2D3344] rounded-2xl text-[#E6E8EC] placeholder-[#9CA3AF] focus:border-[#4ADE80] focus:ring-1 focus:ring-[#4ADE80]/20 transition-all duration-150"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-3">
          {/* Activity indicator */}
          <div className="flex items-center space-x-2 px-3 py-2 bg-[#2D3344] rounded-xl">
            <div className={`w-2 h-2 rounded-full ${
              userBehavior.idleTime > 30000 
                ? 'bg-[#9CA3AF]' 
                : userBehavior.searchCount > 0 || userBehavior.eventClicks > 0
                ? 'bg-[#4ADE80]'
                : 'bg-[#2D3344]'
            }`} />
            <span className="text-[#9CA3AF] text-sm font-mono">
              {userBehavior.idleTime > 30000 ? 'IDLE' : 'ACTIVE'}
            </span>
          </div>

          {/* Notifications */}
          <button className="p-2 rounded-xl hover:bg-[#2D3344] transition-colors duration-150 relative">
            <Bell size={18} className="text-[#9CA3AF]" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#4ADE80] rounded-full"></span>
          </button>

          {/* User menu */}
          <button className="flex items-center space-x-2 p-2 rounded-xl hover:bg-[#2D3344] transition-colors duration-150">
            <div className="w-8 h-8 bg-gradient-to-br from-[#38BDF8] to-[#4ADE80] rounded-xl flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <ChevronDown size={16} className="text-[#9CA3AF]" />
          </button>
        </div>
      </div>
    </motion.header>
  );
});

PremiumTopbar.displayName = 'PremiumTopbar';

export { PremiumTopbar };
