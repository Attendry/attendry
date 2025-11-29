"use client";

import React from "react";
import { SpeakerSearchResult } from "@/lib/services/speaker-search-service";
import { Building2, Briefcase, Calendar, ExternalLink, User } from "lucide-react";
import Link from "next/link";

interface SpeakerResultCardProps {
  result: SpeakerSearchResult;
  onSelect?: (result: SpeakerSearchResult) => void;
  showSimilarity?: boolean;
}

export function SpeakerResultCard({
  result,
  onSelect,
  showSimilarity = false,
}: SpeakerResultCardProps) {
  const similarityPercentage = Math.round(result.similarity * 100);

  return (
    <div
      className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
        onSelect ? "cursor-pointer" : ""
      }`}
      onClick={() => onSelect?.(result)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg truncate">{result.name}</h3>
            {showSimilarity && (
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                {similarityPercentage}% match
              </span>
            )}
          </div>

          {result.org && (
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" />
              <span className="truncate">{result.org}</span>
            </div>
          )}

          {result.title && (
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Briefcase className="h-4 w-4" />
              <span className="truncate">{result.title}</span>
            </div>
          )}

          {result.metadata?.bio && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {result.metadata.bio}
            </p>
          )}

          {result.events && result.events.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Recent Events ({result.events.length})</span>
              </div>
              <div className="space-y-1">
                {result.events.slice(0, 3).map((event, idx) => (
                  <div key={idx} className="text-sm text-muted-foreground pl-6">
                    {event.event_title || "Event"} - {event.talk_title || "Speaker"}
                    {event.appeared_at && (
                      <span className="ml-2 text-xs">
                        ({new Date(event.appeared_at).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                ))}
                {result.events.length > 3 && (
                  <div className="text-xs text-muted-foreground pl-6">
                    +{result.events.length - 3} more events
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="capitalize">{result.source.replace("_", " ")}</span>
            {result.metadata?.email && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                Has email
              </span>
            )}
            {result.metadata?.linkedin && (
              <a
                href={result.metadata.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:text-primary"
              >
                <ExternalLink className="h-3 w-3" />
                LinkedIn
              </a>
            )}
          </div>
        </div>

        {result.speaker_key && (
          <Link
            href={`/speakers?speakerKey=${result.speaker_key}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-primary hover:underline"
          >
            View Profile
          </Link>
        )}
      </div>
    </div>
  );
}

