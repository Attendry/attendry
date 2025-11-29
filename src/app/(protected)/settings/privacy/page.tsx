"use client";

import { PageHeader } from '@/components/Layout/PageHeader';
import { PrivacySettings } from "@/components/settings/PrivacySettings";

export default function PrivacySettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title="Privacy & Data"
          subtitle="Control your data, privacy settings, and GDPR compliance"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Privacy & Data' }
          ]}
        />

        <div className="mt-8">
          <PrivacySettings />
        </div>
      </div>
    </div>
  );
}

