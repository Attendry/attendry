"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BoardItemWithEvent, ColumnStatus } from "@/lib/types/event-board";
import { 
  Calendar, 
  MapPin, 
  Building2, 
  Eye, 
  Edit, 
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Tag,
  Award,
  ExternalLink,
  Clock,
  MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EventBoardCardProps {
  item: BoardItemWithEvent;
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
  // Kanban-specific: prevent card click from triggering drag
  isDragging?: boolean;
  onCardClick?: () => void;
}

export function EventBoardCard({
  item,
  onViewInsights,
  onEdit,
  onRemove,
  onStatusChange,
  isDragging = false,
  onCardClick,
}: EventBoardCardProps) {
  const [expanded, setExpanded] = useState(false);
  const event = item.event || null;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Date TBD";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric", 
        year: "numeric" 
      });
    } catch {
      return "Date TBD";
    }
  };

  const formatTime = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", { 
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return null;
    }
  };

  const getStatusColor = (status: ColumnStatus) => {
    const colors: Record<ColumnStatus, string> = {
      'interested': 'bg-primary/10 text-primary border-primary/20',
      'researching': 'bg-warn/10 text-warn border-warn/20',
      'attending': 'bg-positive/10 text-positive border-positive/20',
      'follow-up': 'bg-accent/10 text-accent border-accent/20',
      'archived': 'bg-surface-alt text-text-secondary border-border-muted'
    };
    return colors[status] || colors.interested;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't expand if clicking on buttons, links, or drag handle, or if dragging
    if (isDragging) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[data-drag-handle]')) return;
    
    if (onCardClick) {
      onCardClick();
    } else {
      setExpanded(!expanded);
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  // Get key information to display on card surface
  const hasTopics = event?.topics && Array.isArray(event.topics) && event.topics.length > 0;
  const hasSpeakers = event?.speakers && Array.isArray(event.speakers) && event.speakers.length > 0;
  const hasSponsors = event?.sponsors && Array.isArray(event.sponsors) && event.sponsors.length > 0;
  const keyTopics = hasTopics ? event.topics.slice(0, 3) : [];
  const keySpeakers = hasSpeakers ? event.speakers.slice(0, 2) : [];
  const timeStr = formatTime(event?.starts_at);

  return (
    <Card 
      className={cn(
        "mb-3 transition-all duration-200 cursor-pointer group",
        "hover:shadow-elevation-2 hover:border-primary/30 hover:-translate-y-0.5",
        expanded && "shadow-elevation-2 border-primary/30",
        isDragging && "opacity-90 scale-[0.98]"
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3 space-y-3 pl-2">
        {/* Title and Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
              {event?.title || item.event_url.split('/').pop() || "Untitled Event"}
            </CardTitle>
            <Badge className={cn("text-xs font-medium", getStatusColor(item.column_status))}>
              {item.column_status}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleActionClick(e, () => setExpanded(!expanded))}
            className="h-7 w-7 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Date and Time - Prominent */}
        {event?.starts_at && (
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-text-primary font-medium">
              <Calendar className="h-4 w-4 text-primary" />
              <span>{formatDate(event.starts_at)}</span>
            </div>
            {timeStr && (
              <div className="flex items-center gap-1 text-text-secondary">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs">{timeStr}</span>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        {(event?.city || event?.country) && (
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin className="h-4 w-4 text-text-muted" />
            <span className="line-clamp-1">
              {event.city && event.country ? `${event.city}, ${event.country}` : event.city || event.country || "Location TBD"}
            </span>
          </div>
        )}

        {/* Topics - Always visible if available */}
        {hasTopics && keyTopics.length > 0 && (
          <div className="flex items-start gap-2">
            <Tag className="h-3.5 w-3.5 mt-1 text-text-muted flex-shrink-0" />
            <div className="flex flex-wrap gap-1 flex-1">
              {keyTopics.map((topic: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs font-normal">
                  {topic}
                </Badge>
              ))}
              {event.topics.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{event.topics.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Key Speakers - Show 1-2 on card */}
        {hasSpeakers && keySpeakers.length > 0 && (
          <div className="flex items-start gap-2">
            <Users className="h-3.5 w-3.5 mt-0.5 text-text-muted flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-secondary space-y-0.5">
                {keySpeakers.map((speaker: any, idx: number) => (
                  <div key={idx} className="line-clamp-1">
                    {speaker.name || speaker.title || 'Speaker'}
                    {speaker.org && <span className="text-text-muted"> • {speaker.org}</span>}
                  </div>
                ))}
                {event.speakers.length > 2 && (
                  <div className="text-text-muted italic">
                    +{event.speakers.length - 2} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions - Always visible on hover */}
        <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {event?.id && onViewInsights && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleActionClick(e, () => onViewInsights(event.id!))}
              className="h-7 text-xs px-2"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Insights
            </Button>
          )}
          {item.notes && (
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="line-clamp-1">{item.notes}</span>
            </div>
          )}
          {event?.source_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(event.source_url, '_blank');
              }}
              className="h-7 w-7 p-0"
              title="Open event page"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Expanded Content */}
      {expanded && (
        <CardContent className="pt-4 space-y-4 border-t bg-surface-alt/50 overflow-hidden">
          {/* Description */}
          {event?.description && (
            <div className="text-sm text-text-secondary leading-relaxed break-words overflow-wrap-anywhere">
              <p className="whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* Venue Details */}
          {event?.venue && (
            <div className="flex items-start gap-2 text-sm break-words">
              <Building2 className="h-4 w-4 mt-0.5 text-text-muted flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-medium text-text-primary">Venue:</span>
                <span className="text-text-secondary ml-1 break-words">{event.venue}</span>
              </div>
            </div>
          )}

          {/* Organizer */}
          {event?.organizer && (
            <div className="text-sm break-words">
              <span className="font-medium text-text-primary">Organizer:</span>
              <span className="text-text-secondary ml-1 break-words">{event.organizer}</span>
            </div>
          )}

          {/* All Topics */}
          {hasTopics && event.topics.length > 3 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-text-primary">All Topics</div>
              <div className="flex flex-wrap gap-1">
                {event.topics.map((topic: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* All Speakers */}
          {hasSpeakers && event.speakers.length > 2 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-text-primary">All Speakers ({event.speakers.length})</div>
              <div className="space-y-1.5">
                {event.speakers.map((speaker: any, idx: number) => (
                  <div key={idx} className="text-sm text-text-secondary break-words">
                    <span className="font-medium break-words">{speaker.name || speaker.title || 'Speaker'}</span>
                    {speaker.org && <span className="text-text-muted break-words"> • {speaker.org}</span>}
                    {speaker.title && speaker.name && <span className="text-text-muted break-words">, {speaker.title}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sponsors */}
          {hasSponsors && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-text-muted" />
                <span className="text-xs font-medium text-text-primary">Sponsors ({event.sponsors.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {event.sponsors.slice(0, 8).map((sponsor: any, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {typeof sponsor === 'string' ? sponsor : sponsor.name || 'Sponsor'}
                  </Badge>
                ))}
                {event.sponsors.length > 8 && (
                  <Badge variant="outline" className="text-xs">
                    +{event.sponsors.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div className="bg-surface-alt p-3 rounded-md border">
              <div className="text-xs font-medium text-text-primary mb-1">Notes</div>
              <div className="text-sm text-text-secondary break-words whitespace-pre-wrap overflow-wrap-anywhere">{item.notes}</div>
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            {event?.id && onViewInsights && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleActionClick(e, () => onViewInsights(event.id!))}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-1" />
                View Insights
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleActionClick(e, () => onEdit(item))}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleActionClick(e, () => onRemove(item.id))}
                className="text-danger hover:text-danger/90"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {event?.source_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(event.source_url, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
