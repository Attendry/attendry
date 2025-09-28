'use client';

import { motion } from 'framer-motion';
import { memo, useMemo, useCallback } from 'react';
import { Menu, Search, Bell, User, ChevronDown } from 'lucide-react';
import { useAdaptive } from './PremiumAdaptiveDashboard';

const ImprovedPremiumTopbar = memo(() => {
  const { 
    setSidebarCollapsed, 
    currentModule, 
    theme,
    userBehavior 
  } = useAdaptive();

  // Memoized module title and description with improved hierarchy
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
      className="h-20 bg-[#1A1F2C] border-b border-[#2D3344] flex items-center px-6"
    >
      <div className="flex items-center justify-between w-full">
        {/* Left side - Improved spacing and typography */}
        <div className="flex items-center space-x-5">
          <button
            onClick={handleSidebarToggle}
            className="p-2.5 rounded-xl hover:bg-[#2D3344] transition-colors duration-150 group"
          >
            <Menu size={20} className="text-[#9CA3AF] group-hover:text-[#E6E8EC] transition-colors" />
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-[#2D3344] rounded-xl flex items-center justify-center">
              <span className="text-xl">{moduleIcon}</span>
            </div>
            <div>
              <h1 className="text-[#E6E8EC] font-semibold text-xl tracking-tight leading-tight">
                {moduleTitle}
              </h1>
              <p className="text-[#9CA3AF] text-sm font-medium mt-0.5">
                {moduleDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Center - Search with improved sizing */}
        <div className="flex-1 max-w-lg mx-8">
          <div className="relative">
            <Search 
              size={18} 
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#9CA3AF]" 
            />
            <input
              type="text"
              placeholder="Search events, locations, topics..."
              className="w-full pl-12 pr-4 py-3.5 bg-[#0B0F1A] border border-[#2D3344] rounded-2xl text-[#E6E8EC] placeholder-[#9CA3AF] focus:border-[#4ADE80] focus:ring-1 focus:ring-[#4ADE80]/20 transition-all duration-150 text-sm font-medium"
            />
          </div>
        </div>

        {/* Right side - Improved spacing and visual hierarchy */}
        <div className="flex items-center space-x-4">
          {/* Activity indicator with better visual weight */}
          <div className="flex items-center space-x-3 px-4 py-2.5 bg-[#2D3344] rounded-xl">
            <div className={`w-2.5 h-2.5 rounded-full ${
              userBehavior.idleTime > 30000 
                ? 'bg-[#9CA3AF]' 
                : userBehavior.searchCount > 0 || userBehavior.eventClicks > 0
                ? 'bg-[#4ADE80]'
                : 'bg-[#2D3344]'
            }`} />
            <span className="text-[#9CA3AF] text-sm font-semibold">
              {userBehavior.idleTime > 30000 ? 'IDLE' : 'ACTIVE'}
            </span>
          </div>

          {/* Notifications with improved visual hierarchy */}
          <button className="p-2.5 rounded-xl hover:bg-[#2D3344] transition-colors duration-150 relative group">
            <Bell size={18} className="text-[#9CA3AF] group-hover:text-[#E6E8EC] transition-colors" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#4ADE80] rounded-full shadow-sm"></span>
          </button>

          {/* User menu with improved visual weight */}
          <button className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-[#2D3344] transition-colors duration-150 group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#38BDF8] to-[#4ADE80] rounded-xl flex items-center justify-center shadow-sm">
              <User size={16} className="text-white" />
            </div>
            <ChevronDown size={16} className="text-[#9CA3AF] group-hover:text-[#E6E8EC] transition-colors" />
          </button>
        </div>
      </div>
    </motion.header>
  );
});

ImprovedPremiumTopbar.displayName = 'ImprovedPremiumTopbar';

export { ImprovedPremiumTopbar };
