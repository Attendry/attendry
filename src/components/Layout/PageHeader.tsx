'use client';

import { ReactNode } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ 
  title, 
  subtitle, 
  breadcrumbs = [], 
  actions, 
  children 
}: PageHeaderProps) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="Breadcrumb">
            <Link 
              href="/" 
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              aria-label="Home"
            >
              <Home size={16} />
            </Link>
            {breadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <ChevronRight size={16} className="text-gray-400" />
                {item.href ? (
                  <Link 
                    href={item.href}
                    className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        )}

        {/* Header Content */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {actions}
            </div>
          )}
        </div>

        {/* Additional Content */}
        {children && (
          <div className="mt-6">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// Pre-built action button combinations
export function PageHeaderActions({ 
  primary, 
  secondary, 
  tertiary 
}: {
  primary?: { label: string; onClick: () => void; loading?: boolean };
  secondary?: { label: string; onClick: () => void; loading?: boolean };
  tertiary?: { label: string; onClick: () => void; loading?: boolean };
}) {
  return (
    <>
      {tertiary && (
        <Button 
          variant="ghost" 
          onClick={tertiary.onClick}
          loading={tertiary.loading}
        >
          {tertiary.label}
        </Button>
      )}
      {secondary && (
        <Button 
          variant="outline" 
          onClick={secondary.onClick}
          loading={secondary.loading}
        >
          {secondary.label}
        </Button>
      )}
      {primary && (
        <Button 
          onClick={primary.onClick}
          loading={primary.loading}
        >
          {primary.label}
        </Button>
      )}
    </>
  );
}
