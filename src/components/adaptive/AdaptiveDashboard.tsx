'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MainContent } from './MainContent';
import { ThemeProvider } from './ThemeProvider';
import { AdaptiveErrorBoundary } from './ErrorBoundary';

// Types for the adaptive interface
export type ModuleType = 'search' | 'recommendations' | 'trending' | 'compare' | 'insights' | 'intelligence';
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
  typingCount?: number;
  taskClicks?: number;
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

  // Refs for performance optimization
  const idleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

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

  // Optimized idle time tracking with debouncing
  useEffect(() => {
    if (idleIntervalRef.current) {
      clearInterval(idleIntervalRef.current);
    }

    idleIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const idleTime = now - userBehavior.lastActivity;
      
      // Only update if idle time changed significantly (debouncing)
      if (Math.abs(idleTime - userBehavior.idleTime) > 1000) {
        setUserBehavior(prev => ({ ...prev, idleTime }));
      }
    }, 2000); // Reduced frequency from 1s to 2s

    return () => {
      if (idleIntervalRef.current) {
        clearInterval(idleIntervalRef.current);
      }
    };
  }, [userBehavior.lastActivity, userBehavior.idleTime]);

  // Memoized and debounced user behavior update
  const updateUserBehavior = useCallback((updates: Partial<UserBehavior>) => {
    const now = Date.now();
    
    // Debounce rapid updates
    if (now - lastUpdateRef.current < 100) {
      return;
    }
    
    lastUpdateRef.current = now;
    
    setUserBehavior(prev => ({
      ...prev,
      ...updates,
      lastActivity: now,
      idleTime: 0,
    }));
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue: AdaptiveContextType = useMemo(() => ({
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
  }), [
    currentModule,
    sidebarCollapsed,
    theme,
    userBehavior,
    updateUserBehavior,
    adaptiveMode,
  ]);

  return (
    <AdaptiveContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <AdaptiveErrorBoundary>
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
                    transition={{ duration: 0.2, ease: 'easeOut' }} // Faster transition
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
        </AdaptiveErrorBoundary>
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
