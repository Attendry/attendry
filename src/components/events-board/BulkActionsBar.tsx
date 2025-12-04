"use client";

import React, { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColumnStatus } from "@/lib/types/event-board";
import { 
  Trash2, 
  Download, 
  Users, 
  Tag,
  ArrowUpDown,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkStatusChange: (status: ColumnStatus) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onBulkExport: () => void;
  onBulkAddToOutreach: () => Promise<void>;
  onBulkTag: (action: 'add' | 'remove', tags: string[]) => Promise<void>;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  onBulkStatusChange,
  onBulkDelete,
  onBulkExport,
  onBulkAddToOutreach,
  onBulkTag,
  className,
}: BulkActionsBarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleStatusChange = async (status: ColumnStatus) => {
    setLoading('status');
    try {
      await onBulkStatusChange(status);
      toast.success("Status updated", {
        description: `${selectedCount} event${selectedCount !== 1 ? 's' : ''} updated`
      });
    } catch (error: any) {
      toast.error("Failed to update status", {
        description: error.message || "An error occurred"
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedCount} event${selectedCount !== 1 ? 's' : ''} from your board?`)) {
      return;
    }
    setLoading('delete');
    try {
      await onBulkDelete();
      toast.success("Events deleted", {
        description: `${selectedCount} event${selectedCount !== 1 ? 's' : ''} removed`
      });
    } catch (error: any) {
      toast.error("Failed to delete", {
        description: error.message || "An error occurred"
      });
    } finally {
      setLoading(null);
    }
  };

  const handleExport = () => {
    onBulkExport();
    toast.success("Events exported", {
      description: `${selectedCount} event${selectedCount !== 1 ? 's' : ''} exported`
    });
  };

  const handleAddToOutreach = async () => {
    setLoading('outreach');
    try {
      await onBulkAddToOutreach();
      toast.success("Outreach lists created", {
        description: `Contacts added from ${selectedCount} event${selectedCount !== 1 ? 's' : ''}`
      });
    } catch (error: any) {
      toast.error("Failed to create outreach lists", {
        description: error.message || "An error occurred"
      });
    } finally {
      setLoading(null);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50",
      "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg",
      "px-4 py-3 flex items-center gap-3",
      className
    )}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mr-2">
        {selectedCount} selected
      </span>

      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Bulk Status Change */}
      <Select
        value=""
        onValueChange={(value) => handleStatusChange(value as ColumnStatus)}
        disabled={loading !== null}
      >
        <SelectTrigger className="w-[140px] h-8">
          <ArrowUpDown className="h-3 w-3 mr-2" />
          <SelectValue placeholder="Change status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="interested">Interested</SelectItem>
          <SelectItem value="researching">Researching</SelectItem>
          <SelectItem value="attending">Attending</SelectItem>
          <SelectItem value="follow-up">Follow-up</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      {/* Bulk Add to Outreach */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddToOutreach}
        disabled={loading !== null}
        className="h-8"
      >
        {loading === 'outreach' ? (
          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
        ) : (
          <Users className="h-3 w-3 mr-2" />
        )}
        Add to Outreach
      </Button>

      {/* Bulk Export */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={loading !== null}
        className="h-8"
      >
        <Download className="h-3 w-3 mr-2" />
        Export
      </Button>

      <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

      {/* Bulk Delete */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={loading !== null}
        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        {loading === 'delete' ? (
          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3 mr-2" />
        )}
        Delete
      </Button>
    </div>
  );
}

