"use client";

import { PageHeader } from '@/components/Layout/PageHeader';
import NotificationSettings from '@/components/NotificationSettings';

export default function NotificationSettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title="Notification Settings"
          subtitle="Configure how and when you receive notifications"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Notifications' }
          ]}
        />

        <div className="mt-8">
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}

