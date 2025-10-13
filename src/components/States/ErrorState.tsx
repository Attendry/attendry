'use client';

import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  children?: ReactNode;
}

export function ErrorState({ 
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  icon,
  action,
  children 
}: ErrorStateProps) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto h-12 w-12 text-red-400 mb-4">
        {icon || <AlertTriangle className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
        {message}
      </p>
      {action && (
        <Button 
          variant="outline" 
          onClick={action.onClick} 
          loading={action.loading}
        >
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

// Pre-built error states for common scenarios
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      action={onRetry ? {
        label: "Try Again",
        onClick: onRetry,
        loading: false
      } : undefined}
    />
  );
}

export function NotFoundError({ resource = 'page' }: { resource?: string }) {
  return (
    <ErrorState
      title={`${resource.charAt(0).toUpperCase() + resource.slice(1)} Not Found`}
      message={`The ${resource} you're looking for doesn't exist or has been moved.`}
      action={{
        label: "Go Home",
        onClick: () => window.location.href = '/'
      }}
    />
  );
}

export function PermissionError() {
  return (
    <ErrorState
      title="Access Denied"
      message="You don't have permission to view this content. Please contact your administrator if you believe this is an error."
      action={{
        label: "Go Back",
        onClick: () => window.history.back()
      }}
    />
  );
}

// Error boundary component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <ErrorState
          title="Something went wrong"
          message="An unexpected error occurred. Please refresh the page."
          action={{
            label: "Refresh Page",
            onClick: () => window.location.reload()
          }}
        />
      );
    }

    return this.props.children;
  }
}
