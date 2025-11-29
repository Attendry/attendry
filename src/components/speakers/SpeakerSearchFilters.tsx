"use client";

import React from "react";
import { X } from "lucide-react";
import { SpeakerSearchOptions } from "@/lib/services/speaker-search-service";

interface SpeakerSearchFiltersProps {
  filters: Partial<SpeakerSearchOptions>;
  onFilterChange: (filters: Partial<SpeakerSearchOptions>) => void;
  onClear: () => void;
}

export function SpeakerSearchFilters({
  filters,
  onFilterChange,
  onClear,
}: SpeakerSearchFiltersProps) {
  const hasActiveFilters =
    filters.org || filters.title || filters.topic || filters.minConfidence;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Organization</label>
          <input
            type="text"
            value={filters.org || ""}
            onChange={(e) =>
              onFilterChange({ ...filters, org: e.target.value || undefined })
            }
            placeholder="Filter by organization"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Job Title</label>
          <input
            type="text"
            value={filters.title || ""}
            onChange={(e) =>
              onFilterChange({ ...filters, title: e.target.value || undefined })
            }
            placeholder="Filter by job title"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Topic</label>
          <input
            type="text"
            value={filters.topic || ""}
            onChange={(e) =>
              onFilterChange({ ...filters, topic: e.target.value || undefined })
            }
            placeholder="Filter by speaking topic"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">
            Min Confidence: {filters.minConfidence ? `${Math.round(filters.minConfidence * 100)}%` : "Any"}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={filters.minConfidence || 0}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                minConfidence: parseFloat(e.target.value) || undefined,
              })
            }
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

