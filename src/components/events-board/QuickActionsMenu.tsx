"use client";

import React, { useState } from "react";
import { BoardItemWithEvent } from "@/lib/types/event-board";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  Edit,
  Users,
  Download,
  Share2,
  Trash2,
  MoreVertical,
  Calendar,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface QuickActionsMenuProps {
  item: BoardItemWithEvent;
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onCreateOutreachList?: (itemId: string) => Promise<void>;
  onExport?: (item: BoardItemWithEvent) => void;
  onShare?: (item: BoardItemWithEvent) => void;
}

export function QuickActionsMenu({
  item,
  onViewInsights,
  onEdit,
  onRemove,
  onCreateOutreachList,
  onExport,
  onShare,
}: QuickActionsMenuProps) {
  const [creatingOutreach, setCreatingOutreach] = useState(false);
  const event = item.event;

  const handleCreateOutreachList = async () => {
    if (!onCreateOutreachList) return;
    
    setCreatingOutreach(true);
    try {
      await onCreateOutreachList(item.id);
    } catch (error: any) {
      toast.error("Failed to create outreach list", {
        description: error.message || "An error occurred"
      });
    } finally {
      setCreatingOutreach(false);
    }
  };

  const handleExport = () => {
    if (!onExport) return;
    onExport(item);
  };

  const handleShare = () => {
    if (!onShare) return;
    onShare(item);
  };

  const handleAddToCalendar = () => {
    if (!event?.starts_at || !event?.title) {
      toast.error("Event date or title missing");
      return;
    }

    const startDate = new Date(event.starts_at);
    const endDate = event.ends_at ? new Date(event.ends_at) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const location = event.venue 
      ? `${event.venue}, ${event.city || ''}, ${event.country || ''}`.trim()
      : `${event.city || ''}, ${event.country || ''}`.trim();

    const description = event.description || '';
    const url = event.source_url || '';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Attendry//Event Board//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${event.title}`,
      description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
      location ? `LOCATION:${location}` : '',
      url ? `URL:${url}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${event.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    toast.success("Calendar file downloaded", {
      description: "Add it to your calendar app"
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {onViewInsights && (item.id || event?.source_url || event?.id) && (
          <DropdownMenuItem
            onClick={() => {
              const identifier = item.id || event?.source_url || event?.id;
              if (identifier) {
                onViewInsights(identifier);
              }
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Insights
          </DropdownMenuItem>
        )}

        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        )}

        {onCreateOutreachList && (
          <DropdownMenuItem
            onClick={handleCreateOutreachList}
            disabled={creatingOutreach}
          >
            {creatingOutreach ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Create Outreach List
          </DropdownMenuItem>
        )}

        {event?.starts_at && (
          <DropdownMenuItem onClick={handleAddToCalendar}>
            <Calendar className="h-4 w-4 mr-2" />
            Add to Calendar
          </DropdownMenuItem>
        )}

        {onExport && (
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Event
          </DropdownMenuItem>
        )}

        {onShare && (
          <DropdownMenuItem onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </DropdownMenuItem>
        )}

        {event?.source_url && (
          <DropdownMenuItem
            onClick={() => window.open(event.source_url, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Event Page
          </DropdownMenuItem>
        )}

        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (confirm("Remove this event from your board?")) {
                  onRemove(item.id);
                }
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove from Board
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

