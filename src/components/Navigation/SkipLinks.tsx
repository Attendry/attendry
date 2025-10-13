'use client';

import Link from 'next/link';

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <Link
        href="#main-content"
        className="absolute top-2 left-2 z-[100] bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Skip to main content
      </Link>
      <Link
        href="#navigation"
        className="absolute top-2 left-32 z-[100] bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Skip to navigation
      </Link>
    </div>
  );
}
