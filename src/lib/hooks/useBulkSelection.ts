/**
 * Bulk Selection Hook
 * Manages selection state for bulk operations on speakers
 */

import { useState, useCallback, useMemo } from 'react';

export interface BulkSelectionOptions {
  maxSelections?: number;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export function useBulkSelection<T extends { id?: string }>(
  items: T[],
  options: BulkSelectionOptions = {}
) {
  const { maxSelections, onSelectionChange } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Get item ID - use id field or generate from name+org
  const getItemId = useCallback((item: T, index: number): string => {
    if (item.id) return item.id;
    // Fallback: use index if no id
    return `item-${index}`;
  }, []);

  // Toggle selection mode
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => !prev);
    if (isSelectMode) {
      // Clear selection when exiting select mode
      setSelectedIds(new Set());
    }
  }, [isSelectMode]);

  // Toggle item selection
  const toggleSelection = useCallback((item: T, index: number) => {
    if (!isSelectMode) return;
    
    const itemId = getItemId(item, index);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        // Check max selections limit
        if (maxSelections && next.size >= maxSelections) {
          return next; // Don't add if at limit
        }
        next.add(itemId);
      }
      return next;
    });
  }, [isSelectMode, maxSelections, getItemId]);

  // Select all items
  const selectAll = useCallback(() => {
    if (!isSelectMode) return;
    
    const allIds = new Set<string>();
    items.forEach((item, index) => {
      const itemId = getItemId(item, index);
      if (!maxSelections || allIds.size < maxSelections) {
        allIds.add(itemId);
      }
    });
    setSelectedIds(allIds);
  }, [isSelectMode, items, maxSelections, getItemId]);

  // Deselect all items
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Check if item is selected
  const isSelected = useCallback((item: T, index: number): boolean => {
    const itemId = getItemId(item, index);
    return selectedIds.has(itemId);
  }, [selectedIds, getItemId]);

  // Get selected items
  const selectedItems = useMemo(() => {
    return items.filter((item, index) => {
      const itemId = getItemId(item, index);
      return selectedIds.has(itemId);
    });
  }, [items, selectedIds, getItemId]);

  // Check if all items are selected
  const allSelected = useMemo(() => {
    if (items.length === 0) return false;
    const selectableCount = maxSelections ? Math.min(items.length, maxSelections) : items.length;
    return selectedIds.size === selectableCount;
  }, [items.length, selectedIds.size, maxSelections]);

  // Check if some items are selected
  const someSelected = useMemo(() => {
    return selectedIds.size > 0 && !allSelected;
  }, [selectedIds.size, allSelected]);

  // Notify parent of selection changes
  useMemo(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  return {
    selectedIds,
    selectedItems,
    isSelectMode,
    allSelected,
    someSelected,
    selectionCount: selectedIds.size,
    toggleSelectMode,
    toggleSelection,
    selectAll,
    deselectAll,
    isSelected,
    clearSelection: deselectAll,
  };
}

