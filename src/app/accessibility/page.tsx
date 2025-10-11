/**
 * Accessibility Page
 * 
 * This page provides accessibility settings and enhancements
 * for users with different needs.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import AccessibilityEnhancements from '@/components/AccessibilityEnhancements';

export default async function AccessibilityPage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-gray-50">
      {!session && (
        <div className="mx-auto max-w-2xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Accessibility Settings"
            description="Sign in to sync your accessibility preferences across devices. Feel free to experiment with the demo controls without signing in."
          />
        </div>
      )}
      <AccessibilityEnhancements />
    </div>
  );
}
