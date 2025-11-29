"use client";

import React from 'react';
import { Search, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

export interface SearchStage {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface SearchProgressIndicatorProps {
  currentStage?: number;
  totalStages?: number;
  stages?: SearchStage[];
  message?: string;
  estimatedTime?: number; // in seconds
  className?: string;
}

const DEFAULT_STAGES: SearchStage[] = [
  {
    id: 'init',
    label: 'Initializing',
    description: 'Preparing search...',
    status: 'pending'
  },
  {
    id: 'discover',
    label: 'Discovering Events',
    description: 'Searching for events matching your criteria...',
    status: 'pending'
  },
  {
    id: 'extract',
    label: 'Extracting Details',
    description: 'Gathering event information and speaker data...',
    status: 'pending'
  },
  {
    id: 'analyze',
    label: 'Analyzing',
    description: 'Processing and ranking results...',
    status: 'pending'
  },
  {
    id: 'complete',
    label: 'Complete',
    description: 'Search completed successfully',
    status: 'pending'
  }
];

export function SearchProgressIndicator({
  currentStage = 0,
  totalStages = 5,
  stages = DEFAULT_STAGES,
  message,
  estimatedTime,
  className = ''
}: SearchProgressIndicatorProps) {
  // Calculate progress percentage
  const progress = totalStages > 0 ? (currentStage / totalStages) * 100 : 0;
  
  // Get current stage info
  const currentStageInfo = stages[currentStage] || stages[0];
  const displayMessage = message || currentStageInfo?.description || 'Searching...';
  
  // Format estimated time
  const formatEstimatedTime = (seconds: number): string => {
    if (seconds < 60) {
      return `~${seconds} seconds`;
    }
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };
  
  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {displayMessage}
          </h3>
          {currentStageInfo && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Step {currentStage + 1} of {totalStages}
            </p>
          )}
        </div>
        {estimatedTime && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {formatEstimatedTime(estimatedTime)}
          </div>
        )}
      </div>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Stage Indicators */}
      {stages.length > 0 && (
        <div className="space-y-2">
          {stages.slice(0, totalStages).map((stage, index) => {
            const isActive = index === currentStage;
            const isCompleted = index < currentStage;
            const isPending = index > currentStage;
            
            return (
              <div
                key={stage.id}
                className={`flex items-center gap-3 text-xs transition-all ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : isCompleted
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-current" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{stage.label}</div>
                  {isActive && stage.description && (
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {stage.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Simplified inline progress indicator
 */
export function InlineSearchProgress({
  message = 'Searching...',
  progress,
  className = ''
}: {
  message?: string;
  progress?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{message}</p>
        {progress !== undefined && (
          <div className="mt-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}


