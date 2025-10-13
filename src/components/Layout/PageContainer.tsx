'use client';

import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function PageContainer({ 
  children, 
  className = '', 
  maxWidth = 'full',
  padding = 'md'
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl', 
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    '2xl': 'max-w-8xl',
    full: 'max-w-full'
  };

  const paddingClasses = {
    none: '',
    sm: 'px-4 py-4',
    md: 'px-4 py-6 sm:px-6 lg:px-8',
    lg: 'px-4 py-8 sm:px-6 lg:px-8'
  };

  return (
    <div className={`
      mx-auto w-full
      ${maxWidthClasses[maxWidth]}
      ${paddingClasses[padding]}
      ${className}
    `}>
      {children}
    </div>
  );
}

// Specialized containers for different content types
export function ContentContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <PageContainer maxWidth="xl" padding="md" className={className}>
      {children}
    </PageContainer>
  );
}

export function NarrowContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <PageContainer maxWidth="md" padding="md" className={className}>
      {children}
    </PageContainer>
  );
}

export function WideContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <PageContainer maxWidth="2xl" padding="md" className={className}>
      {children}
    </PageContainer>
  );
}
