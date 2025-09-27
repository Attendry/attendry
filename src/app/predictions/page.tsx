/**
 * Event Predictions Page
 * 
 * This page provides event predictions using historical data
 * and trends to forecast future events.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import EventPrediction from '@/components/EventPrediction';

export default async function PredictionsPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <EventPrediction />
    </div>
  );
}
