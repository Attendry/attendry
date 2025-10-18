"use client";

import React from 'react';
import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  value: string;
  onRemove?: () => void;
  className?: string;
}

export function FilterChip({ label, value, onRemove, className = '' }: FilterChipProps) {
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium ${className}`}>
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
          aria-label={`Remove ${label} filter`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
