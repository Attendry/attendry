/**
 * Trending Events Page
 * 
 * This page displays trending events and popular categories.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import TrendingEvents from '@/components/TrendingEvents';

export default async function TrendingPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TrendingEvents />
    </div>
  );
}
