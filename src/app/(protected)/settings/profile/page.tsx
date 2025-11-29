"use client";

import { PageHeader } from '@/components/Layout/PageHeader';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfileSettingsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title="Profile Settings"
          subtitle="Manage your personal information and search preferences"
          breadcrumbs={[
            { label: 'Settings', href: '/settings' },
            { label: 'Profile' }
          ]}
        />

        <div className="mt-8 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">
              Profile Settings
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Profile settings are managed in the Advanced Settings page.
            </p>
            <Link
              href="/admin?tab=profile"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Advanced Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

