/**
 * User Activity Page
 * 
 * This page displays the user activity tracking and analytics interface.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { UserActivityTracker } from '@/components/UserActivityTracker';

export default async function ActivityPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <UserActivityTracker />
    </div>
  );
}
