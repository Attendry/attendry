/**
 * Trending Events Page
 * 
 * This page displays trending events and popular categories.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import TrendingEvents from '@/components/TrendingEvents';

export default async function TrendingPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Trending Insights"
            description="Log in to personalize trending events and categories based on your watchlist. Demo data remains available without signing in."
          />
        </div>
      )}
      <TrendingEvents />
    </div>
  );
}
