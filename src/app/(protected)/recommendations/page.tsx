/**
 * Market Intelligence Page
 * 
 * This page displays the unified Market Intelligence experience with both
 * Event Recommendations and Account Intelligence features.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import { MarketIntelligenceStandalone } from '@/components/MarketIntelligenceStandalone';

export default async function MarketIntelligencePage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Market Intelligence"
            description="Log in to access AI-powered event recommendations and strategic account monitoring. You can continue exploring the demo results without signing in."
          />
        </div>
      )}
      <div className="max-w-6xl mx-auto p-6">
        <MarketIntelligenceStandalone />
      </div>
    </div>
  );
}
