/**
 * System Health Monitoring Page
 * 
 * This page provides real-time system health monitoring
 * for administrators.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SystemHealthMonitor from '@/components/SystemHealthMonitor';

export default async function SystemHealthPage() {
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
      <SystemHealthMonitor />
    </div>
  );
}
