/**
 * Recommendations Page
 * 
 * This page displays AI-powered event recommendations for users.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RecommendationEngine from '@/components/RecommendationEngine';

export default async function RecommendationsPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <RecommendationEngine />
    </div>
  );
}
