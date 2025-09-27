'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAdaptive } from './AdaptiveDashboard';
import { SearchModule } from './modules/SearchModule';
import { RecommendationsModule } from './modules/RecommendationsModule';
import { TrendingModule } from './modules/TrendingModule';
import { CompareModule } from './modules/CompareModule';
import { InsightsModule } from './modules/InsightsModule';

export const MainContent = () => {
  const { currentModule, theme } = useAdaptive();

  const moduleComponents = {
    search: SearchModule,
    recommendations: RecommendationsModule,
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
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="h-full"
          >
            <CurrentModule />
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
};
