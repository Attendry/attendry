"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users, X, Undo2 } from 'lucide-react';
import { getRecentAutoSaveEvents, undoAutoSave } from '@/lib/services/auto-save-feedback-service';
import { notificationService } from '@/lib/services/notification-service';
import Link from 'next/link';

interface AutoSaveNotificationProps {
  userId: string;
  onUndo?: (contactId: string) => void;
}

export function AutoSaveNotification({ userId, onUndo }: AutoSaveNotificationProps) {
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const loadRecentEvents = async () => {
      const events = await getRecentAutoSaveEvents(userId, 5);
      setRecentEvents(events);

      // Show browser notification for most recent event
      if (events.length > 0) {
        const mostRecent = events[0];
        if (mostRecent.speakers_saved > 0) {
          const eventTitle = mostRecent.event_title || 'an event';
          await notificationService.showNotification({
            title: '✨ Speakers Auto-Saved',
            body: `${mostRecent.speakers_saved} speaker${mostRecent.speakers_saved !== 1 ? 's' : ''} auto-saved from ${eventTitle}`,
            tag: `auto-save-${mostRecent.id}`,
          });
        }
      }
    };

    loadRecentEvents();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadRecentEvents, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleUndo = async (contactId: string) => {
    const success = await undoAutoSave(contactId, userId);
    
    if (success) {
      toast.success('Auto-save undone. Contact removed.');
      onUndo?.(contactId);
      // Refresh events
      const events = await getRecentAutoSaveEvents(userId, 5);
      setRecentEvents(events);
    } else {
      toast.error('Unable to undo. The 24-hour window may have expired.');
    }
  };

  if (!showNotifications || recentEvents.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {recentEvents.slice(0, 3).map((event) => (
        <div
          key={event.id}
          className="bg-white border border-blue-200 rounded-lg shadow-lg p-4 flex items-start gap-3"
        >
          <div className="flex-shrink-0 mt-0.5">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {event.speakers_saved} speaker{event.speakers_saved !== 1 ? 's' : ''} auto-saved
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  from {event.event_title || 'an event'}
                </p>
                {event.created_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(event.created_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Link
                href="/contacts?filter=auto-saved-today"
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                View contacts
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

