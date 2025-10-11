/**
 * Notification Settings Page
 * 
 * This page displays the notification settings management interface.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import NotificationSettings from '@/components/NotificationSettings';

export default async function NotificationsPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Notification Settings"
            description="Sign in to save notification preferences and sync with your account. Demo defaults remain visible without signing in."
          />
        </div>
      )}
      <NotificationSettings />
    </div>
  );
}
