'use client';

import { OutreachManager } from '@/components/outreach/OutreachManager';

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
        <OutreachManager />
      </div>
    </div>
  );
}
