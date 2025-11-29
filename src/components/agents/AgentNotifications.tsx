'use client';

import { useAgentNotifications } from '@/lib/hooks/useAgentNotifications';
import { Mail, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export function AgentNotifications() {
  const { pendingApprovals, loading } = useAgentNotifications({ 
    enabled: true,
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds
  });
  const [isHovered, setIsHovered] = useState(false);

  if (loading && pendingApprovals === 0) {
    return null; // Don't show anything while loading initially
  }

  if (pendingApprovals === 0) {
    return null; // Don't show if no pending approvals
  }

  return (
    <Link
      href="/agents/approvals"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition-all hover:bg-amber-100 hover:border-amber-300"
    >
      <Mail className="h-4 w-4" />
      <span className="hidden sm:inline">
        {pendingApprovals} Pending Approval{pendingApprovals !== 1 ? 's' : ''}
      </span>
      <span className="sm:hidden">
        {pendingApprovals}
      </span>
      {pendingApprovals > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
          {pendingApprovals > 99 ? '99+' : pendingApprovals}
        </span>
      )}
    </Link>
  );
}

