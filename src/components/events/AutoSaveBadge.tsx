"use client";

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getEventAutoSavedCount } from '@/lib/services/auto-save-feedback-service';
import Link from 'next/link';

interface AutoSaveBadgeProps {
  eventId: string;
  userId: string;
  eventTitle?: string;
}

export function AutoSaveBadge({ eventId, userId, eventTitle }: AutoSaveBadgeProps) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !userId) {
      setLoading(false);
      return;
    }

    const loadCount = async () => {
      try {
        const autoSavedCount = await getEventAutoSavedCount(eventId, userId);
        setCount(autoSavedCount);
      } catch (error) {
        console.error('Error loading auto-saved count:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCount();
  }, [eventId, userId]);

  if (loading || count === null || count === 0) {
    return null;
  }

  return (
    <Link
      href={`/contacts?filter=auto-saved-today&event=${eventId}`}
      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium hover:bg-green-200 transition-colors"
      title={`${count} speaker${count !== 1 ? 's' : ''} auto-saved from this event`}
    >
      <Users className="w-3 h-3" />
      <span>{count} auto-saved</span>
    </Link>
  );
}

