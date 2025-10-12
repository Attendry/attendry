'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, lazy, memo } from 'react';
import { useAdaptive } from './AdaptiveDashboard';

// Lazy load modules for better performance
const SearchModule = lazy(() => import('./modules/SearchModule').then(m => ({ default: m.SearchModule })));
const MarketIntelligenceModule = lazy(() => import('./modules/MarketIntelligenceModule').then(m => ({ default: m.MarketIntelligenceModule })));
const TrendingModule = lazy(() => import('./modules/TrendingModule').then(m => ({ default: m.TrendingModule })));
const CompareModule = lazy(() => import('./modules/CompareModule').then(m => ({ default: m.CompareModule })));
const InsightsModule = lazy(() => import('./modules/InsightsModule').then(m => ({ default: m.InsightsModule })));

// Loading component
const ModuleLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const MainContent = memo(() => {
  const { currentModule, theme } = useAdaptive();

  const moduleComponents = {
    search: SearchModule,
    recommendations: MarketIntelligenceModule,
    trending: TrendingModule,
    compare: CompareModule,
    insights: InsightsModule,
  };

  const CurrentModule = moduleComponents[currentModule];

  return (
    <main className={`flex-1 overflow-hidden transition-colors duration-300 ${
      theme === 'dark' 
        ? 'bg-gray-900' 
        : theme === 'high-contrast'
        ? 'bg-black'
        : 'bg-gray-50'
    }`}>
      <div className="h-full p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentModule}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }} // Faster transition
            className="h-full"
          >
            <Suspense fallback={<ModuleLoader />}>
              <CurrentModule />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
});

MainContent.displayName = 'MainContent';

export { MainContent };
