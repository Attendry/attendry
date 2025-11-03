'use client';

import { useState, memo } from 'react';
import { 
  TrendingUp,
  Brain
} from 'lucide-react';

// Import the original RecommendationEngine for the Event Recommendations tab
import RecommendationEngine from '@/components/RecommendationEngine';

export const MarketIntelligenceStandalone = memo(() => {
  // No more tabs - just show event recommendations and trends
  const [showMigrationBanner, setShowMigrationBanner] = useState(true);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Market Intelligence
            </h2>
            <p className="text-sm text-gray-600">
              Pipeline-ready event recommendations and market trends
            </p>
          </div>
        </div>

        {/* Migration Banner */}
        {showMigrationBanner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 relative">
            <button
              onClick={() => setShowMigrationBanner(false)}
              className="absolute top-2 right-2 text-blue-400 hover:text-blue-600"
              aria-label="Close banner"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center pr-6">
              <TrendingUp className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">Account Intelligence has moved! 🎯</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Speaker outreach and account monitoring are now in your <a href="/" className="font-semibold underline hover:text-blue-900">Dashboard</a> - 
                  your central command centre for managing all speaker intelligence and outreach.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Demo Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <Brain className="h-5 w-5 text-blue-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Market Intelligence</h3>
              <p className="text-sm text-blue-700">
                Discover AI-powered event recommendations and trending market insights to find your next opportunity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Event Recommendations */}
      <div className="flex-1 overflow-hidden">
        <RecommendationEngine />
      </div>
    </div>
  );
});

MarketIntelligenceStandalone.displayName = 'MarketIntelligenceStandalone';
