/**
 * System Health Monitor Component
 * 
 * This component provides real-time system health monitoring
 * with alerts and status indicators.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';

/**
 * Health check interface
 */
interface HealthCheck {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  lastChecked: string;
  message?: string;
}

/**
 * System Health Monitor Component
 */
const SystemHealthMonitor = memo(function SystemHealthMonitor() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Load health checks
  useEffect(() => {
    const loadHealthChecks = async () => {
      try {
        const response = await fetch('/api/admin/health');
        if (response.ok) {
          const data = await response.json();
          setHealthChecks(data.healthChecks || []);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('Failed to load health checks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHealthChecks();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(loadHealthChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  // Get status color
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-slate-600 bg-slate-100';
    }
  }, []);

  // Get status icon
  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      default: return '?';
    }
  }, []);

  // Format response time
  const formatResponseTime = useCallback((time: number) => {
    if (time < 1000) {
      return `${time}ms`;
    } else {
      return `${(time / 1000).toFixed(2)}s`;
    }
  }, []);

  // Format last checked time
  const formatLastChecked = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  }, []);

  // Get overall system status
  const getOverallStatus = useCallback(() => {
    if (healthChecks.length === 0) return 'unknown';
    
    const hasError = healthChecks.some(check => check.status === 'error');
    const hasWarning = healthChecks.some(check => check.status === 'warning');
    
    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'healthy';
  }, [healthChecks]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">System Health Monitor</h1>
            <p className="text-slate-600">Real-time monitoring of system components and services</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(getOverallStatus())}`}>
              <span className="mr-2">{getStatusIcon(getOverallStatus())}</span>
              {getOverallStatus().charAt(0).toUpperCase() + getOverallStatus().slice(1)}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Health Checks */}
      <div className="space-y-4">
        {healthChecks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No health checks available</h3>
            <p className="text-slate-600">Health monitoring data will appear here</p>
          </div>
        ) : (
          healthChecks.map((check) => (
            <div key={check.service} className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    check.status === 'healthy' ? 'bg-green-500' :
                    check.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <h3 className="text-lg font-medium text-slate-900">{check.service}</h3>
                    {check.message && (
                      <p className="text-sm text-slate-600">{check.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Response Time</p>
                    <p className="text-lg font-medium text-slate-900">
                      {formatResponseTime(check.responseTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Last Checked</p>
                    <p className="text-sm text-slate-900">
                      {formatLastChecked(check.lastChecked)}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(check.status)}`}>
                    {getStatusIcon(check.status)} {check.status}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* System Status Summary */}
      {healthChecks.length > 0 && (
        <div className="mt-8 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">System Status Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {healthChecks.filter(check => check.status === 'healthy').length}
              </div>
              <p className="text-sm text-slate-600 mt-2">Healthy Services</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {healthChecks.filter(check => check.status === 'warning').length}
              </div>
              <p className="text-sm text-slate-600 mt-2">Warning Services</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {healthChecks.filter(check => check.status === 'error').length}
              </div>
              <p className="text-sm text-slate-600 mt-2">Error Services</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SystemHealthMonitor;
