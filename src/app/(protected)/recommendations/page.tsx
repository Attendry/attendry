/**
 * Recommendations Page
 * 
 * This page displays AI-powered event recommendations for users.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import RecommendationEngine from '@/components/RecommendationEngine';

export default async function RecommendationsPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Personalized Recommendations"
            description="Log in to generate tailored event recommendations based on your saved lists and search history. You can continue exploring the demo results without signing in."
          />
        </div>
      )}
      <RecommendationEngine />
    </div>
  );
}
