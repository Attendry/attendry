'use client';

import { ReactNode } from 'react';

interface LoadingStateProps {
  message?: string;
  context?: 'search' | 'save' | 'fetch' | 'load' | 'default';
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
}

const contextMessages = {
  search: 'Searching...',
  save: 'Saving...',
  fetch: 'Fetching...',
  load: 'Loading...',
  default: 'Loading...'
};

export function LoadingState({ 
  message,
  context = 'default',
  children,
  size,
  inline = false
}: LoadingStateProps) {
  const displayMessage = message || contextMessages[context];
  
  // Auto-size for inline states
  const effectiveSize = size || (inline ? 'sm' : 'md');
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  if (inline) {
    return (
      <div className="flex items-center gap-2">
        <div className={`animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 ${sizeClasses[effectiveSize]}`} />
        <span className="text-sm text-slate-500 dark:text-slate-400">{displayMessage}</span>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className={`animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 ${sizeClasses[effectiveSize]} mb-4`} />
      <p className="text-sm text-slate-500 dark:text-slate-400">{displayMessage}</p>
      {children}
    </div>
  );
}

// Skeleton loading components
export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 animate-pulse">
      <div className="flex items-center space-x-4 mb-4">
        <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex space-x-4">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1" />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
          <div className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
