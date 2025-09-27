'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, lazy, memo } from 'react';
import { useAdaptive } from './PremiumAdaptiveDashboard';

// Lazy load modules for better performance
const SearchModule = lazy(() => import('./modules/PremiumSearchModule').then(m => ({ default: m.PremiumSearchModule })));
const RecommendationsModule = lazy(() => import('./modules/RecommendationsModule').then(m => ({ default: m.RecommendationsModule })));
const TrendingModule = lazy(() => import('./modules/TrendingModule').then(m => ({ default: m.TrendingModule })));
const CompareModule = lazy(() => import('./modules/CompareModule').then(m => ({ default: m.CompareModule })));
const InsightsModule = lazy(() => import('./modules/InsightsModule').then(m => ({ default: m.InsightsModule })));
const PremiumDemo = lazy(() => import('./PremiumDemo').then(m => ({ default: m.PremiumDemo })));

// Premium loading component
const PremiumModuleLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-8 h-8 border-2 border-[#4ADE80] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[#9CA3AF] text-sm font-mono">Loading module...</p>
    </div>
  </div>
);

const PremiumMainContent = memo(() => {
  const { currentModule } = useAdaptive();

  const moduleComponents = {
    search: SearchModule,
    recommendations: RecommendationsModule,
    trending: TrendingModule,
    compare: CompareModule,
    insights: InsightsModule,
  };

  // Show demo for search module initially
  const CurrentModule = currentModule === 'search' ? PremiumDemo : moduleComponents[currentModule];

  return (
    <main className="flex-1 bg-[#0B0F1A] overflow-hidden">
      <div className="h-full p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentModule}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="h-full"
          >
            <Suspense fallback={<PremiumModuleLoader />}>
              <CurrentModule />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
});

PremiumMainContent.displayName = 'PremiumMainContent';

export { PremiumMainContent };
