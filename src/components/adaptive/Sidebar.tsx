'use client';

import { motion } from 'framer-motion';
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
  ZapOff
} from 'lucide-react';
import { useAdaptive } from './AdaptiveDashboard';

export const Sidebar = () => {
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

  const modules = [
    { id: 'search' as const, label: 'Search', icon: Search, count: userBehavior.searchCount },
    { id: 'recommendations' as const, label: 'Recommendations', icon: Heart, count: userBehavior.savedEvents },
    { id: 'trending' as const, label: 'Trending', icon: TrendingUp, count: 0 },
    { id: 'compare' as const, label: 'Compare', icon: GitCompare, count: userBehavior.eventClicks },
    { id: 'insights' as const, label: 'Insights', icon: Lightbulb, count: 0 },
  ];

  const themeOptions = [
    { id: 'light' as const, label: 'Light', icon: Sun },
    { id: 'dark' as const, label: 'Dark', icon: Moon },
    { id: 'high-contrast' as const, label: 'High Contrast', icon: Contrast },
  ];

  return (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`h-full w-70 border-r transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-gray-800 border-gray-700' 
          : theme === 'high-contrast'
          ? 'bg-gray-900 border-gray-600'
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className={`text-xl font-semibold ${
            theme === 'high-contrast' ? 'text-white' : 'text-gray-900'
          }`}>
            Attendry
          </h1>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'hover:bg-gray-700 text-gray-300' 
                : theme === 'high-contrast'
                ? 'hover:bg-gray-800 text-white'
                : 'hover:bg-gray-100 text-gray-600'
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
                onClick={() => setCurrentModule(module.id)}
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
                    ? 'hover:bg-gray-700 text-gray-300'
                    : theme === 'high-contrast'
                    ? 'hover:bg-gray-800 text-white'
                    : 'hover:bg-gray-50 text-gray-700'
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
                      ? 'bg-gray-600 text-gray-300'
                      : 'bg-gray-200 text-gray-600'
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
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Adaptive Mode
          </h3>
          <button
            onClick={() => setAdaptiveMode(!adaptiveMode)}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
              adaptiveMode
                ? theme === 'dark'
                  ? 'bg-green-600 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-700'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : theme === 'high-contrast'
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
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
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
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
                  onClick={() => setTheme(option.id)}
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
                      ? 'hover:bg-gray-700 text-gray-400'
                      : theme === 'high-contrast'
                      ? 'hover:bg-gray-800 text-gray-300'
                      : 'hover:bg-gray-100 text-gray-600'
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
            ? 'bg-gray-700' 
            : theme === 'high-contrast'
            ? 'bg-gray-800'
            : 'bg-gray-50'
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
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                User
              </p>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Event Discovery
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
