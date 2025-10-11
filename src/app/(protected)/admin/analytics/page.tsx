/**
 * Analytics Dashboard Page
 * 
 * This page provides comprehensive analytics and reporting
 * for administrators.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default async function AnalyticsPage() {
  const { supabase, session } = await getServerSession();

  if (!session || !supabase) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Admin Analytics"
            description="Sign in with an admin account to access detailed analytics. Demo panels remain available without signing in."
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
            feature="Admin Analytics"
            description="Analytics are limited to admin users. Reach out to the admin team if you need additional privileges."
            loginHref="/"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AnalyticsDashboard />
    </div>
  );
}
