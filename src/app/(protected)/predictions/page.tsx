/**
 * Event Predictions Page
 * 
 * This page provides event predictions using historical data
 * and trends to forecast future events.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import EventPrediction from '@/components/EventPrediction';

export default async function PredictionsPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Event Predictions"
            description="Sign in to generate forward-looking event predictions tailored to your markets. Demo forecasts remain available without signing in."
          />
        </div>
      )}
      <EventPrediction />
    </div>
  );
}
