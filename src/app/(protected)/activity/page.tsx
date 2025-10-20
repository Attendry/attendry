/**
 * User Activity Page
 * 
 * This page displays the user activity tracking and analytics interface.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import { UserActivityTracker } from '@/components/UserActivityTracker';

// Force dynamic rendering since we use server session
export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-2xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Activity Insights"
            description="Sign in to unlock tracked activity across searches, saves, and event engagement. You can continue browsing the demo view without signing in."
          />
        </div>
      )}
      <UserActivityTracker />
    </div>
  );
}
