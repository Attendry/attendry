'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MainContent } from './MainContent';
import { ThemeProvider } from './ThemeProvider';

// Types for the adaptive interface
export type ModuleType = 'search' | 'recommendations' | 'trending' | 'compare' | 'insights';
export type ThemeMode = 'light' | 'dark' | 'high-contrast';

export interface UserBehavior {
  searchCount: number;
  eventClicks: number;
  savedEvents: number;
  lastActivity: number;
  idleTime: number;
  searchHistory: string[];
  preferredLocations: string[];
  preferredIndustries: string[];
}

export interface AdaptiveContextType {
  currentModule: ModuleType;
  setCurrentModule: (module: ModuleType) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  userBehavior: UserBehavior;
  updateUserBehavior: (updates: Partial<UserBehavior>) => void;
  adaptiveMode: boolean;
  setAdaptiveMode: (enabled: boolean) => void;
}

const AdaptiveContext = createContext<AdaptiveContextType | undefined>(undefined);

export const useAdaptive = () => {
  const context = useContext(AdaptiveContext);
  if (!context) {
    throw new Error('useAdaptive must be used within an AdaptiveProvider');
  }
  return context;
};

interface AdaptiveProviderProps {
  children: ReactNode;
}

const AdaptiveProvider = ({ children }: AdaptiveProviderProps) => {
  const [currentModule, setCurrentModule] = useState<ModuleType>('search');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [adaptiveMode, setAdaptiveMode] = useState<boolean>(true);
  const [userBehavior, setUserBehavior] = useState<UserBehavior>({
    searchCount: 0,
    eventClicks: 0,
    savedEvents: 0,
    lastActivity: Date.now(),
    idleTime: 0,
    searchHistory: [],
    preferredLocations: [],
    preferredIndustries: [],
  });

  // Auto-detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mediaQuery.matches ? 'dark' : 'light');

    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Adaptive behavior logic - less aggressive and optional
  useEffect(() => {
    if (!adaptiveMode) return; // Skip if adaptive mode is disabled
    
    const { searchCount, eventClicks, idleTime, savedEvents } = userBehavior;
    
    // Only switch modules if user has been idle for a longer period
    // and hasn't been actively using the interface
    if (idleTime > 30000) { // 30 seconds idle (increased from 10)
      setCurrentModule('insights');
    } else if (eventClicks >= 5) { // Increased threshold
      setCurrentModule('compare');
    } else if (savedEvents >= 3) { // Increased threshold
      setCurrentModule('recommendations');
    }
    // Remove automatic switching to search - let user stay where they are
  }, [userBehavior, adaptiveMode]);

  // Auto-collapse sidebar when user is heavily focused on main content
  useEffect(() => {
    if (!adaptiveMode) return; // Skip if adaptive mode is disabled
    
    const { searchCount, eventClicks } = userBehavior;
    // Only collapse after more activity to be less intrusive
    if (searchCount > 5 || eventClicks > 4) {
      setSidebarCollapsed(true);
    }
  }, [userBehavior, adaptiveMode]);

  // Track idle time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - userBehavior.lastActivity;
      setUserBehavior(prev => ({ ...prev, idleTime }));
    }, 1000);

    return () => clearInterval(interval);
  }, [userBehavior.lastActivity]);

  const updateUserBehavior = (updates: Partial<UserBehavior>) => {
    setUserBehavior(prev => ({
      ...prev,
      ...updates,
      lastActivity: Date.now(),
      idleTime: 0,
    }));
  };

  const contextValue: AdaptiveContextType = {
    currentModule,
    setCurrentModule,
    sidebarCollapsed,
    setSidebarCollapsed,
    theme,
    setTheme,
    userBehavior,
    updateUserBehavior,
    adaptiveMode,
    setAdaptiveMode,
  };

  return (
    <AdaptiveContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <div className={`min-h-screen transition-colors duration-300 ${
          theme === 'dark' 
            ? 'bg-gray-900 text-white' 
            : theme === 'high-contrast'
            ? 'bg-black text-white'
            : 'bg-gray-50 text-gray-900'
        }`}>
          <div className="flex h-screen">
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="flex-shrink-0"
                >
                  <Sidebar />
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex-1 flex flex-col min-w-0">
              <Topbar />
              <MainContent />
            </div>
          </div>
        </div>
      </ThemeProvider>
    </AdaptiveContext.Provider>
  );
};

export const AdaptiveDashboard = () => {
  return (
    <AdaptiveProvider>
      <div className="adaptive-dashboard">
        {/* The actual dashboard content is rendered by AdaptiveProvider */}
      </div>
    </AdaptiveProvider>
  );
};
