/**
 * Performance Dashboard Component
 * 
 * This component provides a real-time performance monitoring dashboard
 * for developers and administrators.
 */

"use client";
import { useState, useEffect, useCallback } from 'react';
import { performanceMonitor, PerformanceUtils } from '@/lib/performance-monitor';

/**
 * Performance dashboard props
 */
interface PerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Performance Dashboard Component
 */
export default function PerformanceDashboard({ isOpen, onClose }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * Refresh performance data
   */
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const currentMetrics = PerformanceUtils.getMetrics();
      const currentSummary = PerformanceUtils.getSummary();
      setMetrics(currentMetrics);
      setSummary(currentSummary);
    } catch (error) {
      console.error('Failed to refresh performance data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Auto-refresh data
   */
  useEffect(() => {
    if (!isOpen) return;

    refreshData();
    const interval = setInterval(refreshData, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [isOpen, refreshData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {summary && (
            <div className="space-y-6">
              {/* Core Web Vitals */}
              {metrics?.pageLoad && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">First Contentful Paint</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.pageLoad.firstContentfulPaint 
                          ? `${Math.round(metrics.pageLoad.firstContentfulPaint)}ms`
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Largest Contentful Paint</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.pageLoad.largestContentfulPaint 
                          ? `${Math.round(metrics.pageLoad.largestContentfulPaint)}ms`
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Cumulative Layout Shift</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.pageLoad.cumulativeLayoutShift 
                          ? metrics.pageLoad.cumulativeLayoutShift.toFixed(3)
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Performance */}
              {metrics?.api && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">API Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Total Requests</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.api.totalRequests || 0}
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Avg Response Time</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.api.averageResponseTime 
                          ? `${Math.round(metrics.api.averageResponseTime)}ms`
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Error Rate</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.api.errorRate 
                          ? `${(metrics.api.errorRate * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Slow Requests</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.api.slowRequests || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User Interactions */}
              {metrics?.interactions && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">User Interactions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Total Clicks</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.interactions.totalClicks || 0}
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Avg Click Delay</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.interactions.averageClickDelay 
                          ? `${Math.round(metrics.interactions.averageClickDelay)}ms`
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Scroll Depth</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.interactions.scrollDepth || 0}%
                      </div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-sm text-gray-500">Time on Page</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metrics.interactions.timeOnPage 
                          ? `${Math.round(metrics.interactions.timeOnPage / 1000)}s`
                          : 'N/A'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Event Counts */}
              {summary.eventCounts && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Counts</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(summary.eventCounts).map(([type, count]) => (
                      <div key={type} className="bg-white rounded-md p-3">
                        <div className="text-sm text-gray-500 capitalize">
                          {type.replace('_', ' ')}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {count as number}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {summary.recommendations && summary.recommendations.length > 0 && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-4">Recommendations</h3>
                  <ul className="space-y-2">
                    {summary.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-yellow-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => PerformanceUtils.logSummary()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Log to Console
                </button>
                <button
                  onClick={() => {
                    performanceMonitor.clear();
                    refreshData();
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                >
                  Clear Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
