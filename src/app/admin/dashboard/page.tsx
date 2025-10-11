/**
 * Admin Dashboard Page
 * 
 * This page provides the admin dashboard interface with
 * user management, analytics, and system monitoring.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import AdminDashboard from '@/components/AdminDashboard';

export default async function AdminDashboardPage() {
  const { supabase, session } = await getServerSession();

  if (!session || !supabase) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Admin Dashboard"
            description="Admin analytics require authentication. Sign in with an admin account to manage users, track health, and review metrics."
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
            feature="Admin Dashboard"
            description="This area is restricted to admin users. Please contact an administrator if you need elevated access."
            loginHref="/"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminDashboard />
    </div>
  );
}
