'use client';

import { motion } from 'framer-motion';
import { memo, useMemo, useCallback } from 'react';
import { 
  Search, 
  Heart, 
  TrendingUp, 
  GitCompare, 
  Lightbulb, 
  Settings, 
  User,
  Menu,
  Zap,
  ZapOff,
  ChevronRight
} from 'lucide-react';
import { useAdaptive } from './PremiumAdaptiveDashboard';

const ImprovedPremiumSidebar = memo(() => {
  const { 
    currentModule, 
    setCurrentModule, 
    setSidebarCollapsed, 
    theme, 
    setTheme,
    userBehavior,
    adaptiveMode,
    setAdaptiveMode
  } = useAdaptive();

  // Memoized modules array with improved hierarchy
  const modules = useMemo(() => [
    { 
      id: 'search' as const, 
      label: 'Search', 
      icon: Search, 
      count: userBehavior.searchCount,
      description: 'Find events',
      priority: 'primary'
    },
    { 
      id: 'recommendations' as const, 
      label: 'Recommendations', 
      icon: Heart, 
      count: userBehavior.savedEvents,
      description: 'Personalized',
      priority: 'secondary'
    },
    { 
      id: 'trending' as const, 
      label: 'Trending', 
      icon: TrendingUp, 
      count: 0,
      description: 'Popular now',
      priority: 'secondary'
    },
    { 
      id: 'compare' as const, 
      label: 'Compare', 
      icon: GitCompare, 
      count: userBehavior.eventClicks,
      description: 'Side by side',
      priority: 'secondary'
    },
    { 
      id: 'insights' as const, 
      label: 'Insights', 
      icon: Lightbulb, 
      count: 0,
      description: 'AI analysis',
      priority: 'secondary'
    },
  ], [userBehavior.searchCount, userBehavior.savedEvents, userBehavior.eventClicks]);

  // Memoized event handlers
  const handleModuleClick = useCallback((moduleId: typeof currentModule) => {
    setCurrentModule(moduleId);
  }, [setCurrentModule]);

  const handleAdaptiveModeToggle = useCallback(() => {
    setAdaptiveMode(!adaptiveMode);
  }, [adaptiveMode, setAdaptiveMode]);

  return (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="w-72 h-full bg-[#1A1F2C] border-r border-[#2D3344] flex flex-col"
    >
      {/* Header - Improved spacing and typography */}
      <div className="px-6 py-5 border-b border-[#2D3344]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#4ADE80] to-[#38BDF8] rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-semibold text-base">A</span>
            </div>
            <div>
              <h1 className="text-[#E6E8EC] font-semibold text-xl tracking-tight leading-tight">
                Attendry
              </h1>
              <p className="text-[#9CA3AF] text-sm font-medium">
                Event Discovery
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="p-2.5 rounded-xl hover:bg-[#2D3344] transition-colors duration-150 group"
          >
            <Menu size={18} className="text-[#9CA3AF] group-hover:text-[#E6E8EC] transition-colors" />
          </button>
        </div>
      </div>

      {/* Navigation - Improved spacing and visual hierarchy */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {modules.map((module) => {
          const Icon = module.icon;
          const isActive = currentModule === module.id;
          
          return (
            <motion.button
              key={module.id}
              onClick={() => handleModuleClick(module.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-150 group ${
                isActive
                  ? 'bg-[#4ADE80]/10 border border-[#4ADE80]/20 text-[#4ADE80] shadow-sm'
                  : 'hover:bg-[#2D3344]/50 text-[#9CA3AF] hover:text-[#E6E8EC]'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div className={`p-2.5 rounded-xl transition-colors duration-150 ${
                  isActive 
                    ? 'bg-[#4ADE80]/20' 
                    : 'bg-[#2D3344] group-hover:bg-[#2D3344]/80'
                }`}>
                  <Icon size={18} />
                </div>
                <div className="text-left">
                  <div className={`font-semibold text-sm leading-tight ${
                    isActive ? 'text-[#4ADE80]' : 'text-[#E6E8EC]'
                  }`}>
                    {module.label}
                  </div>
                  <div className={`text-xs font-medium mt-0.5 ${
                    isActive ? 'text-[#4ADE80]/70' : 'text-[#9CA3AF]'
                  }`}>
                    {module.description}
                  </div>
                </div>
              </div>
              {module.count > 0 && (
                <div className={`px-2.5 py-1 text-xs rounded-full font-semibold ${
                  isActive 
                    ? 'bg-[#4ADE80]/20 text-[#4ADE80]' 
                    : 'bg-[#2D3344] text-[#9CA3AF]'
                }`}>
                  {module.count}
                </div>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Adaptive Mode Toggle - Improved visual hierarchy */}
      <div className="px-4 pb-6 border-t border-[#2D3344] pt-6">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
            Adaptive Mode
          </h3>
        </div>
        <button
          onClick={handleAdaptiveModeToggle}
          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-150 ${
            adaptiveMode
              ? 'bg-[#4ADE80]/10 border border-[#4ADE80]/20'
              : 'bg-[#2D3344] border border-[#2D3344] hover:border-[#2D3344]/80'
          }`}
        >
          <div className="flex items-center space-x-4">
            <div className={`p-2.5 rounded-xl transition-colors duration-150 ${
              adaptiveMode ? 'bg-[#4ADE80]/20' : 'bg-[#2D3344]'
            }`}>
              {adaptiveMode ? <Zap size={16} className="text-[#4ADE80]" /> : <ZapOff size={16} className="text-[#9CA3AF]" />}
            </div>
            <div className="text-left">
              <div className={`font-semibold text-sm ${
                adaptiveMode ? 'text-[#4ADE80]' : 'text-[#9CA3AF]'
              }`}>
                {adaptiveMode ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-xs font-medium text-[#9CA3AF] mt-0.5">
                Smart UI adaptation
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-[#9CA3AF]" />
        </button>
      </div>

      {/* User Profile - Improved spacing */}
      <div className="px-4 pb-6">
        <div className="flex items-center space-x-3 p-4 rounded-2xl bg-[#2D3344]">
          <div className="w-10 h-10 bg-gradient-to-br from-[#38BDF8] to-[#4ADE80] rounded-xl flex items-center justify-center shadow-sm">
            <User size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#E6E8EC] font-semibold text-sm truncate">
              User
            </p>
            <p className="text-[#9CA3AF] text-xs font-medium">
              Event Discovery
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ImprovedPremiumSidebar.displayName = 'ImprovedPremiumSidebar';

export { ImprovedPremiumSidebar };
