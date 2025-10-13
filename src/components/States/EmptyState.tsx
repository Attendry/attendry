'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  children?: ReactNode;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  children 
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} loading={action.loading}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

// Pre-built empty states for common scenarios
export function EmptyEvents() {
  return (
    <EmptyState
      icon={
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      title="No events found"
      description="Get started by searching for events or creating your first event."
      action={{
        label: "Search Events",
        onClick: () => window.location.href = '/search'
      }}
    />
  );
}

export function EmptySearch() {
  return (
    <EmptyState
      icon={
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      title="No results found"
      description="Try adjusting your search terms or filters to find what you're looking for."
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L12.828 7H4.828z" />
        </svg>
      }
      title="All caught up!"
      description="You don't have any notifications right now."
    />
  );
}
