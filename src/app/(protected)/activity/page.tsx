"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { UnauthenticatedNotice } from '@/components/UnauthenticatedNotice';
import { UserActivityTracker } from '@/components/UserActivityTracker';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function ActivityPage() {
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null);
        setAuthReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Checking your session...
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 pt-10">
          <UnauthenticatedNotice
            feature="Activity Insights"
            description="Sign in to unlock tracked activity across searches, saves, and event engagement. You can continue browsing the demo view without signing in."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <UserActivityTracker />
    </div>
  );
}
