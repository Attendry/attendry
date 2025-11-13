/**
 * DynamicSpeakerLayout Component
 * 
 * A dynamic layout system for speaker cards that reorganizes when cards are expanded.
 * When a card expands, it moves to a prominent position while other cards form a compact list.
 * 
 * Features:
 * - Dynamic layout reorganization on expansion
 * - Compact list view for non-expanded cards
 * - Smooth transitions between states
 * - Click-to-expand from the list
 * - Focus on expanded card with overview of others
 * 
 * @author Attendry Team
 * @version 1.0
 */

"use client";
import React, { useState } from "react";
import ExpandableSpeakerCard from "./ExpandableSpeakerCard";
import { SpeakerData } from "@/lib/types/core";
import { ChevronRight, Users, Linkedin } from "lucide-react";

interface DynamicSpeakerLayoutProps {
  speakers: SpeakerData[];
  sessionTitle?: string;
}

export default function DynamicSpeakerLayout({ speakers, sessionTitle }: DynamicSpeakerLayoutProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggleExpansion = (index: number, expanded: boolean) => {
    if (expanded) {
      setExpandedIndex(index);
    } else {
      setExpandedIndex(null);
    }
  };

  const handleListCardClick = (index: number) => {
    setExpandedIndex(index);
  };

  const isExpanded = expandedIndex !== null;
  const expandedSpeaker = expandedIndex !== null ? speakers[expandedIndex] : null;
  const listSpeakers = speakers.filter((_, index) => index !== expandedIndex);

  return (
    <div className="w-full">
      {!isExpanded ? (
        // Initial Grid Layout - All cards in grid
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {speakers.map((speaker, index) => (
            <ExpandableSpeakerCard
              key={index}
              speaker={speaker}
              sessionTitle={sessionTitle}
              isExpanded={false}
              onToggleExpansion={(expanded) => handleToggleExpansion(index, expanded)}
            />
          ))}
        </div>
      ) : (
        // Dynamic Layout - Expanded card + compact list
        <div className="flex gap-6 h-full">
          {/* Expanded Card - Left Side */}
          <div className="flex-1">
            {expandedSpeaker && (
              <div className="sticky top-6">
                <ExpandableSpeakerCard
                  speaker={expandedSpeaker}
                  sessionTitle={sessionTitle}
                  isExpanded={true}
                  onToggleExpansion={(expanded) => {
                    if (!expanded) {
                      setExpandedIndex(null);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Compact List - Right Side */}
          <div className="w-80 flex-shrink-0">
            <div className="sticky top-6">
              {/* List Header */}
              <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <Users size={16} />
                  <span>All Speakers ({listSpeakers.length + 1})</span>
                </div>
              </div>

              {/* Compact Speaker List */}
              <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                {listSpeakers.map((speaker, listIndex) => {
                  const originalIndex = speakers.findIndex(s => s.name === speaker.name);
                  return (
                    <div key={originalIndex} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group">
                      <div 
                        onClick={() => handleListCardClick(originalIndex)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 dark:text-white truncate">
                            {speaker.name}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {speaker.title || 'Title not provided'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 truncate">
                            {speaker.org || 'Organization not provided'}
                          </div>
                        </div>
                        <ChevronRight 
                          size={16} 
                          className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0 ml-2" 
                        />
                      </div>
                      
                      {/* Quick LinkedIn Search */}
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <a
                          href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(speaker.name + (speaker.org ? ` ${speaker.org}` : ''))}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          <Linkedin size={12} />
                          LinkedIn Search
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
