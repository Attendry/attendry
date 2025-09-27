/**
 * Loading States Component
 * 
 * This component provides various loading states and skeleton screens
 * for better perceived performance.
 */

"use client";
import { memo } from 'react';

/**
 * Loading States Component
 */
const LoadingStates = memo(function LoadingStates() {
  return (
    <div className="space-y-6">
      {/* Skeleton Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>

      {/* Skeleton List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-4 bg-gray-200 rounded w-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skeleton Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/5"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Skeleton Card Component
 */
export const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  );
});

/**
 * Skeleton List Component
 */
export const SkeletonList = memo(function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="animate-pulse">
        <div className="space-y-3">
          {[...Array(items)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-4 bg-gray-200 rounded w-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/**
 * Skeleton Table Component
 */
export const SkeletonTable = memo(function SkeletonTable({ rows = 3, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="animate-pulse">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            {[...Array(rows)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                {[...Array(cols)].map((_, j) => (
                  <div key={j} className="h-3 bg-gray-200 rounded w-1/4"></div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Skeleton Button Component
 */
export const SkeletonButton = memo(function SkeletonButton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-24"></div>
    </div>
  );
});

/**
 * Skeleton Input Component
 */
export const SkeletonInput = memo(function SkeletonInput() {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-full"></div>
    </div>
  );
});

/**
 * Skeleton Avatar Component
 */
export const SkeletonAvatar = memo(function SkeletonAvatar() {
  return (
    <div className="animate-pulse">
      <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
    </div>
  );
});

/**
 * Skeleton Text Component
 */
export const SkeletonText = memo(function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse">
      <div className="space-y-2">
        {[...Array(lines)].map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded w-full"></div>
        ))}
      </div>
    </div>
  );
});

/**
 * Loading Spinner Component
 */
export const LoadingSpinner = memo(function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
  );
});

/**
 * Loading Dots Component
 */
export const LoadingDots = memo(function LoadingDots() {
  return (
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    </div>
  );
});

/**
 * Loading Bar Component
 */
export const LoadingBar = memo(function LoadingBar({ progress = 0 }: { progress?: number }) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
});

/**
 * Loading Overlay Component
 */
export const LoadingOverlay = memo(function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
        <LoadingSpinner />
        <span className="text-gray-700">{message}</span>
      </div>
    </div>
  );
});

export default LoadingStates;
