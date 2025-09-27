/**
 * Accessibility Page
 * 
 * This page provides accessibility settings and enhancements
 * for users with different needs.
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AccessibilityEnhancements from '@/components/AccessibilityEnhancements';

export default async function AccessibilityPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AccessibilityEnhancements />
    </div>
  );
}
