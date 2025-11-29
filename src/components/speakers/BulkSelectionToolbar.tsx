"use client";

import { CheckSquare, Square, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BulkSelectionToolbarProps {
  isSelectMode: boolean;
  selectionCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkSave: () => Promise<void>;
  isSaving?: boolean;
  maxSelections?: number;
}

export function BulkSelectionToolbar({
  isSelectMode,
  selectionCount,
  allSelected,
  someSelected,
  onToggleSelectMode,
  onSelectAll,
  onDeselectAll,
  onBulkSave,
  isSaving = false,
  maxSelections,
}: BulkSelectionToolbarProps) {
  if (!isSelectMode && selectionCount === 0) {
    return (
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onToggleSelectMode}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <CheckSquare className="w-4 h-4" />
          Select Speakers
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={allSelected ? onDeselectAll : onSelectAll}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {allSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
              <span>{allSelected ? "Deselect All" : "Select All"}</span>
            </button>
            {maxSelections && (
              <span className="text-xs text-gray-500">
                (Max {maxSelections} selections)
              </span>
            )}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-medium">{selectionCount}</span> speaker{selectionCount !== 1 ? 's' : ''} selected
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onBulkSave}
            disabled={selectionCount === 0 || isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save {selectionCount} Contact{selectionCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
          <button
            onClick={onToggleSelectMode}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

