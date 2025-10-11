'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumSidebar } from './PremiumSidebar';
import { PremiumTopbar } from './PremiumTopbar';
import { PremiumMainContent } from './PremiumMainContent';
import { PremiumActionRail } from './PremiumActionRail';
import { ThemeProvider } from './ThemeProvider';
import { AdaptiveErrorBoundary } from './ErrorBoundary';

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
  const [theme, setTheme] = useState<ThemeMode>('dark'); // Default to dark mode
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

  // Auto-detect system theme preference (but default to dark)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    // Keep dark mode as default for premium look
    setTheme('dark');

    const handleChange = (e: MediaQueryListEvent) => {
      // Still respect system preference but with dark as fallback
      setTheme(e.matches ? 'dark' : 'dark');
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
    if (idleTime > 30000) { // 30 seconds idle
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
          <div className="min-h-screen bg-[#0B0F1A] text-[#E6E8EC] font-sans">
            <div className="flex h-screen">
              {/* Sidebar */}
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 288, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="flex-shrink-0"
                  >
                    <PremiumSidebar />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Main Content Area */}
              <div className="flex-1 flex flex-col min-w-0">
                <PremiumTopbar />
                <div className="flex-1 flex">
                  <PremiumMainContent />
                  <PremiumActionRail />
                </div>
              </div>
            </div>
          </div>
        </AdaptiveErrorBoundary>
      </ThemeProvider>
    </AdaptiveContext.Provider>
  );
};

export const PremiumAdaptiveDashboard = () => {
  return <AdaptiveProvider>{null}</AdaptiveProvider>;
};
