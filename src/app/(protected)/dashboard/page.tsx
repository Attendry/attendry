/**
 * Dashboard Page - Speaker Outreach Command Centre
 * 
 * The main dashboard where users can quickly identify and engage with
 * target speakers for outreach. Combines AI-powered recommendations,
 * pipeline management, and account intelligence in one actionable view.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import { Dashboard } from '@/components/Dashboard/Dashboard';

// Force dynamic rendering since we use server session
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Dashboard"
            description="Sign in to access your personalized speaker outreach command centre with AI-powered recommendations and pipeline management."
          />
        </div>
      )}
      <div className="h-full">
        <Dashboard />
      </div>
    </div>
  );
}