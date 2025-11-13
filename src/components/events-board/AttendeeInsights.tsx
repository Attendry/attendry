"use client";

import React from "react";
import { AttendeeInsight } from "@/lib/types/event-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mic, Building2, Briefcase } from "lucide-react";

interface AttendeeInsightsProps {
  attendees: AttendeeInsight[];
}

export function AttendeeInsights({ attendees }: AttendeeInsightsProps) {
  const roleCounts = attendees.reduce((acc, attendee) => {
    acc[attendee.role] = (acc[attendee.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const roleIcons = {
    speaker: Mic,
    sponsor: Building2,
    attendee: Users,
    organizer: Briefcase,
    partner: Building2,
  };

  const roleLabels = {
    speaker: "Speakers",
    sponsor: "Sponsors",
    attendee: "Attendees",
    organizer: "Organizers",
    partner: "Partners",
  };

  if (attendees.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No attendee information available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Role Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(roleCounts).map(([role, count]) => {
          const Icon = roleIcons[role as keyof typeof roleIcons] || Users;
          return (
            <Card key={role} className="p-3">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-gray-600">
                    {roleLabels[role as keyof typeof roleLabels] || role}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Attendee List */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">Attendees</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {attendees.map((attendee, idx) => (
            <Card key={idx} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">{attendee.name}</div>
                  {attendee.company && (
                    <div className="text-xs text-gray-600 mt-1">
                      {attendee.company}
                    </div>
                  )}
                  {attendee.title && (
                    <div className="text-xs text-gray-500 mt-1">
                      {attendee.title}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-xs">
                    {attendee.role}
                  </Badge>
                  {attendee.confidence && attendee.confidence < 0.8 && (
                    <span className="text-xs text-gray-400">
                      {(attendee.confidence * 100).toFixed(0)}% confidence
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

