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
  ChevronUp
} from "lucide-react";

interface EventBoardCardProps {
  item: BoardItemWithEvent;
  onViewInsights?: (eventId: string) => void;
  onEdit?: (item: BoardItemWithEvent) => void;
  onRemove?: (itemId: string) => void;
  onStatusChange?: (itemId: string, status: ColumnStatus) => void;
}

export function EventBoardCard({
  item,
  onViewInsights,
  onEdit,
  onRemove,
  onStatusChange
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

  const getStatusColor = (status: ColumnStatus) => {
    const colors: Record<ColumnStatus, string> = {
      'interested': 'bg-blue-100 text-blue-800',
      'researching': 'bg-yellow-100 text-yellow-800',
      'attending': 'bg-green-100 text-green-800',
      'follow-up': 'bg-purple-100 text-purple-800',
      'archived': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.interested;
  };

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold line-clamp-2 mb-2">
              {event?.title || item.event_url.split('/').pop() || "Untitled Event"}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatusColor(item.column_status)}>
                {item.column_status}
              </Badge>
              {event?.starts_at && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Calendar className="h-3 w-3" />
                  {formatDate(event.starts_at)}
                </div>
              )}
              {event?.city && event?.country && (
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <MapPin className="h-3 w-3" />
                  {event.city}, {event.country}
                </div>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 p-0"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {event?.description && (
            <p className="text-sm text-gray-600 line-clamp-3">
              {event.description}
            </p>
          )}

          {event?.venue && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 className="h-4 w-4" />
              <span>{event.venue}</span>
            </div>
          )}

          {event?.organizer && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Organizer:</span> {event.organizer}
            </div>
          )}

          {item.notes && (
            <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
              <span className="font-medium">Notes:</span> {item.notes}
            </div>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            {event?.id && onViewInsights && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewInsights(event.id!)}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-1" />
                Insights
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(item.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

