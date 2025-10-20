"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface ProcessingJob {
  id: string;
  type: 'calendar' | 'events';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

interface ProcessingStatusBarProps {
  jobs: ProcessingJob[];
  onJobComplete?: (job: ProcessingJob) => void;
  onRefresh?: () => void;
}

export default function ProcessingStatusBar({ jobs, onJobComplete, onRefresh }: ProcessingStatusBarProps) {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  // Auto-expand completed or failed jobs
  useEffect(() => {
    jobs.forEach(job => {
      if ((job.status === 'completed' || job.status === 'failed') && !expandedJobs.has(job.id)) {
        setExpandedJobs(prev => new Set([...prev, job.id]));
        if (onJobComplete) {
          onJobComplete(job);
        }
      }
    });
  }, [jobs, expandedJobs, onJobComplete]);

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const formatDuration = (startedAt: Date, completedAt?: Date) => {
    const end = completedAt || new Date();
    const duration = Math.floor((end.getTime() - startedAt.getTime()) / 1000);
    
    if (duration < 60) {
      return `${duration}s`;
    } else {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    }
  };

  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <AnimatePresence>
        {jobs.map((job) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`mb-3 rounded-lg border p-4 shadow-lg ${getStatusColor(job.status)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(job.status)}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm">
                      {job.type === 'calendar' ? 'Calendar Analysis' : 'Events Enhancement'}
                    </span>
                    <span className="text-xs opacity-75">
                      {formatDuration(job.startedAt, job.completedAt)}
                    </span>
                  </div>
                  <div className="text-xs mt-1">{job.message}</div>
                  
                  {job.status === 'processing' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <motion.div
                          className="bg-blue-500 h-1.5 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${job.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {job.status === 'completed' && onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="p-1 hover:bg-green-100 rounded-full transition-colors"
                    title="Refresh to see results"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                
                <button
                  onClick={() => toggleJobExpansion(job.id)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <motion.div
                    animate={{ rotate: expandedJobs.has(job.id) ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.div>
                </button>
              </div>
            </div>
            
            {expandedJobs.has(job.id) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t border-current border-opacity-20"
              >
                <div className="text-xs space-y-2">
                  <div>
                    <span className="font-medium">Job ID:</span> {job.id}
                  </div>
                  
                  {job.status === 'completed' && job.result && (
                    <div>
                      <span className="font-medium">Results:</span>
                      <div className="mt-1 space-y-1">
                        {job.result.speakers && (
                          <div>Speakers found: {job.result.speakers.length}</div>
                        )}
                        {job.result.crawl_stats && (
                          <div>Pages crawled: {job.result.crawl_stats.pages_crawled}</div>
                        )}
                        {job.result.event_metadata && (
                          <div>Event: {job.result.event_metadata.title}</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {job.status === 'failed' && job.error && (
                    <div>
                      <span className="font-medium">Error:</span>
                      <div className="mt-1 text-red-600">{job.error}</div>
                    </div>
                  )}
                  
                  <div className="text-xs opacity-75">
                    Started: {job.startedAt.toLocaleTimeString()}
                    {job.completedAt && (
                      <span> • Completed: {job.completedAt.toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
