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
  Sun,
  Moon,
  Contrast,
  Zap,
  ZapOff,
  Brain
} from 'lucide-react';
import { useAdaptive } from './AdaptiveDashboard';

const Sidebar = memo(() => {
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

  // Memoized modules array to prevent unnecessary re-renders
  const modules = useMemo(() => [
    { id: 'search' as const, label: 'Search', icon: Search, count: userBehavior.searchCount },
    { id: 'recommendations' as const, label: 'Market Intelligence', icon: Brain, count: userBehavior.savedEvents },
    { id: 'trending' as const, label: 'Trending', icon: TrendingUp, count: 0 },
    { id: 'compare' as const, label: 'Compare', icon: GitCompare, count: userBehavior.eventClicks },
    { id: 'insights' as const, label: 'Insights', icon: Lightbulb, count: 0 },
  ], [userBehavior.searchCount, userBehavior.savedEvents, userBehavior.eventClicks]);

  // Memoized theme options
  const themeOptions = useMemo(() => [
    { id: 'light' as const, label: 'Light', icon: Sun },
    { id: 'dark' as const, label: 'Dark', icon: Moon },
    { id: 'high-contrast' as const, label: 'High Contrast', icon: Contrast },
  ], []);

  // Memoized event handlers
  const handleModuleClick = useCallback((moduleId: typeof currentModule) => {
    setCurrentModule(moduleId);
  }, [setCurrentModule]);

  const handleThemeChange = useCallback((themeId: typeof theme) => {
    setTheme(themeId);
  }, [setTheme]);

  const handleAdaptiveModeToggle = useCallback(() => {
    setAdaptiveMode(!adaptiveMode);
  }, [adaptiveMode, setAdaptiveMode]);

  return (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`h-full w-70 border-r transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-800 border-slate-700' 
          : theme === 'high-contrast'
          ? 'bg-slate-900 border-slate-600'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className={`text-xl font-semibold ${
            theme === 'high-contrast' ? 'text-white' : 'text-slate-900'
          }`}>
            Attendry
          </h1>
          <button
            onClick={() => setSidebarCollapsed(true)}
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
        </div>

        {/* Navigation */}
        <nav className="space-y-2 mb-8">
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = currentModule === module.id;
            
            return (
              <motion.button
                key={module.id}
                onClick={() => handleModuleClick(module.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? theme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : theme === 'high-contrast'
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                    : theme === 'dark'
                    ? 'hover:bg-slate-700 text-slate-300'
                    : theme === 'high-contrast'
                    ? 'hover:bg-slate-800 text-white'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={20} />
                  <span className="font-medium">{module.label}</span>
                </div>
                {module.count > 0 && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    isActive
                      ? 'bg-blue-500 text-white'
                      : theme === 'dark'
                      ? 'bg-slate-600 text-slate-300'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {module.count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Adaptive Mode Toggle */}
        <div className="mb-6">
          <h3 className={`text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Adaptive Mode
          </h3>
          <button
            onClick={handleAdaptiveModeToggle}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              adaptiveMode
                ? theme === 'dark'
                  ? 'bg-green-600 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-700'
                : theme === 'dark'
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : theme === 'high-contrast'
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {adaptiveMode ? <Zap size={16} /> : <ZapOff size={16} />}
              <span className="text-sm font-medium">
                {adaptiveMode ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className={`w-8 h-4 rounded-full transition-colors ${
              adaptiveMode
                ? theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                : theme === 'dark' ? 'bg-slate-600' : 'bg-slate-300'
            }`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                adaptiveMode ? 'translate-x-4' : 'translate-x-0.5'
              } mt-0.5`} />
            </div>
          </button>
        </div>

        {/* Theme Selector */}
        <div className="mb-8">
          <h3 className={`text-sm font-medium mb-3 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Theme
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.id;
              
              return (
                <motion.button
                  key={option.id}
                  onClick={() => handleThemeChange(option.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-2 rounded-lg transition-colors ${
                    isActive
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
                  }`}
                  title={option.label}
                >
                  <Icon size={16} />
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* User Profile */}
        <div className={`p-3 rounded-lg ${
          theme === 'dark' 
            ? 'bg-slate-700' 
            : theme === 'high-contrast'
            ? 'bg-slate-800'
            : 'bg-slate-50'
        }`}>
          <div className="flex items-center space-x-3">
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
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                User
              </p>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
              }`}>
                Event Discovery
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

Sidebar.displayName = 'Sidebar';

export { Sidebar };
