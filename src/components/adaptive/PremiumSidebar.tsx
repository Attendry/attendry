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

const PremiumSidebar = memo(() => {
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

  // Memoized modules array
  const modules = useMemo(() => [
    { 
      id: 'search' as const, 
      label: 'Search', 
      icon: Search, 
      count: userBehavior.searchCount,
      description: 'Find events'
    },
    { 
      id: 'recommendations' as const, 
      label: 'Recommendations', 
      icon: Heart, 
      count: userBehavior.savedEvents,
      description: 'Personalized'
    },
    { 
      id: 'trending' as const, 
      label: 'Trending', 
      icon: TrendingUp, 
      count: 0,
      description: 'Popular now'
    },
    { 
      id: 'compare' as const, 
      label: 'Compare', 
      icon: GitCompare, 
      count: userBehavior.eventClicks,
      description: 'Side by side'
    },
    { 
      id: 'insights' as const, 
      label: 'Insights', 
      icon: Lightbulb, 
      count: 0,
      description: 'AI analysis'
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
      {/* Header */}
      <div className="p-6 border-b border-[#2D3344]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#4ADE80] to-[#38BDF8] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <h1 className="text-[#E6E8EC] font-semibold text-lg tracking-tight">
                Attendry
              </h1>
              <p className="text-[#9CA3AF] text-xs">
                Event Discovery
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="p-2 rounded-xl hover:bg-[#2D3344] transition-colors duration-150"
          >
            <Menu size={18} className="text-[#9CA3AF]" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {modules.map((module) => {
          const Icon = module.icon;
          const isActive = currentModule === module.id;
          
          return (
            <motion.button
              key={module.id}
              onClick={() => handleModuleClick(module.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-150 group ${
                isActive
                  ? 'bg-[#4ADE80]/10 border border-[#4ADE80]/30 text-[#4ADE80]'
                  : 'hover:bg-[#2D3344] text-[#9CA3AF] hover:text-[#E6E8EC]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl transition-colors duration-150 ${
                  isActive 
                    ? 'bg-[#4ADE80]/20' 
                    : 'bg-[#2D3344] group-hover:bg-[#2D3344]/80'
                }`}>
                  <Icon size={18} />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">{module.label}</div>
                  <div className={`text-xs ${
                    isActive ? 'text-[#4ADE80]/70' : 'text-[#9CA3AF]'
                  }`}>
                    {module.description}
                  </div>
                </div>
              </div>
              {module.count > 0 && (
                <div className={`px-2 py-1 text-xs rounded-full font-mono ${
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

      {/* Adaptive Mode Toggle */}
      <div className="p-4 border-t border-[#2D3344]">
        <div className="mb-3">
          <h3 className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wider">
            Adaptive Mode
          </h3>
        </div>
        <button
          onClick={handleAdaptiveModeToggle}
          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-150 ${
            adaptiveMode
              ? 'bg-[#4ADE80]/10 border border-[#4ADE80]/30'
              : 'bg-[#2D3344] border border-[#2D3344] hover:border-[#2D3344]/80'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl transition-colors duration-150 ${
              adaptiveMode ? 'bg-[#4ADE80]/20' : 'bg-[#2D3344]'
            }`}>
              {adaptiveMode ? <Zap size={16} className="text-[#4ADE80]" /> : <ZapOff size={16} className="text-[#9CA3AF]" />}
            </div>
            <div className="text-left">
              <div className={`font-medium text-sm ${
                adaptiveMode ? 'text-[#4ADE80]' : 'text-[#9CA3AF]'
              }`}>
                {adaptiveMode ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-xs text-[#9CA3AF]">
                Smart UI adaptation
              </div>
            </div>
          </div>
          <ChevronRight size={16} className="text-[#9CA3AF]" />
        </button>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-[#2D3344]">
        <div className="flex items-center space-x-3 p-3 rounded-2xl bg-[#2D3344]">
          <div className="w-10 h-10 bg-gradient-to-br from-[#38BDF8] to-[#4ADE80] rounded-xl flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#E6E8EC] font-medium text-sm truncate">
              User
            </p>
            <p className="text-[#9CA3AF] text-xs">
              Event Discovery
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

PremiumSidebar.displayName = 'PremiumSidebar';

export { PremiumSidebar };
