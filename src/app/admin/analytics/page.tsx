/**
 * Analytics Dashboard Page
 * 
 * This page provides comprehensive analytics and reporting
 * for administrators.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default async function AnalyticsPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile || !profile.is_admin) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AnalyticsDashboard />
    </div>
  );
}
