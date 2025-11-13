"use client";

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { usePagination } from '@/context/SearchResultsContext';

interface EventsPaginationProps {
  className?: string;
}

export function EventsPagination({ className = '' }: EventsPaginationProps) {
  const {
    currentPage,
    totalPages,
    totalResults,
    pageSize,
    hasResults,
    canGoToPreviousPage,
    canGoToNextPage,
    goToPreviousPage,
    goToNextPage,
    setPage,
  } = usePagination();

  if (!hasResults || totalPages <= 1) {
    return null;
  }

  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 4) {
        // Show first 5 pages + ellipsis + last page
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Show first page + ellipsis + last 5 pages
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first page + ellipsis + current-1, current, current+1 + ellipsis + last page
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Results info */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Showing {startResult} to {endResult} of {totalResults} results
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={goToPreviousPage}
          disabled={!canGoToPreviousPage}
          className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
            canGoToPreviousPage
              ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 py-2 text-slate-500 dark:text-slate-400"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </span>
              );
            }

            const isCurrentPage = page === currentPage;
            return (
              <button
                key={page}
                onClick={() => setPage(page)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isCurrentPage
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={goToNextPage}
          disabled={!canGoToNextPage}
          className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
            canGoToNextPage
              ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default EventsPagination;
