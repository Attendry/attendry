/**
 * System Health Monitoring Page
 * 
 * This page provides real-time system health monitoring
 * for administrators.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import SystemHealthMonitor from '@/components/SystemHealthMonitor';

export default async function SystemHealthPage() {
  const { supabase, session } = await getServerSession();

  if (!session || !supabase) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="System Health"
            description="Sign in as an admin to monitor system health across services."
          />
        </div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile || !profile.is_admin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="System Health"
            description="This dashboard is limited to admin users."
            loginHref="/"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SystemHealthMonitor />
    </div>
  );
}
