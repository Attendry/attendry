/**
 * User Profile Page
 * 
 * This page displays the user profile and preferences management interface.
 */

import { getServerSession } from '@/lib/auth/server-session';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import UserProfile from '@/components/UserProfile';

// Force dynamic rendering since we use server session
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { session } = await getServerSession();

  return (
    <div className="min-h-screen bg-slate-50">
      {!session && (
        <div className="mx-auto max-w-3xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Profile Customization"
            description="Sign in to personalize industries, locations, and notification preferences. You can browse the demo profile layout without signing in."
          />
        </div>
      )}
      <UserProfile />
    </div>
  );
}
