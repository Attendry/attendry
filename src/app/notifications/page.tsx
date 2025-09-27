/**
 * Notification Settings Page
 * 
 * This page displays the notification settings management interface.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import NotificationSettings from '@/components/NotificationSettings';

export default async function NotificationsPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NotificationSettings />
    </div>
  );
}
