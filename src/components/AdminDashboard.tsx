/**
 * Admin Dashboard Component
 * 
 * This component provides a comprehensive admin interface with
 * user management, analytics, and system monitoring.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
// import { useUser } from '@supabase/auth-helpers-react';

/**
 * Dashboard metrics interface
 */
interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalEvents: number;
  totalSearches: number;
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    responseTime: number;
    errorRate: number;
  };
  userGrowth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  eventStats: {
    collected: number;
    processed: number;
    errors: number;
  };
}

/**
 * User interface
 */
interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  is_active: boolean;
  profile?: any;
}

/**
 * Role and Module types
 */
type RoleKey = 'Seller' | 'Marketing' | 'Admin';
type ModuleId = 'smartSearch' | 'accountSignals' | 'eventInsights' | 'accountWatchlist' | 'compareEvents' | 'eventsCalendar' | 'alerts' | 'adminOps';

/**
 * Role access interface
 */
interface RoleAccess {
  smartSearch: boolean;
  accountSignals: boolean;
  eventInsights: boolean;
  accountWatchlist: boolean;
  compareEvents: boolean;
  eventsCalendar: boolean;
  alerts: boolean;
  adminOps: boolean;
}

/**
 * Module interface
 */
interface Module {
  id: ModuleId;
  label: string;
}

/**
 * Default permissions
 */
const defaultPermissions = () => ({
  roles: {
    Seller: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: false,
    },
    Marketing: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: false,
    },
    Admin: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: true,
    },
  },
  assignments: {
    // Mock assignments for demonstration
    'user123': 'Seller',
    'user456': 'Marketing',
    'user789': 'Admin',
  },
});

/**
 * Modules available for access control
 */
const MODULES: Module[] = [
  { id: 'smartSearch', label: 'Smart Search' },
  { id: 'accountSignals', label: 'Account Signals' },
  { id: 'eventInsights', label: 'Event Insights' },
  { id: 'accountWatchlist', label: 'Account Watchlist' },
  { id: 'compareEvents', label: 'Compare Events' },
  { id: 'eventsCalendar', label: 'Events Calendar' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'adminOps', label: 'Admin Operations' },
];

/**
 * Role options for user assignment
 */
const ROLE_OPTIONS: RoleKey[] = ['Seller', 'Marketing', 'Admin'];

/**
 * Admin Dashboard Component
 */
const AdminDashboard = memo(function AdminDashboard() {
  // const { user } = useUser();
  const user = null; // Mock for now
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'permissions' | 'analytics' | 'system'>('overview');
  const [roleAccess, setRoleAccess] = useState<Record<RoleKey, RoleAccess>>({
    Seller: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: false,
    },
    Marketing: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: false,
    },
    Admin: {
      smartSearch: true,
      accountSignals: true,
      eventInsights: true,
      accountWatchlist: true,
      compareEvents: true,
      eventsCalendar: true,
      alerts: true,
      adminOps: true,
    },
  });
  const [pendingRoleAssignments, setPendingRoleAssignments] = useState<Record<string, RoleKey>>({});
  const [roleAssignments, setRoleAssignments] = useState<Record<string, RoleKey>>({});
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [metricsResponse, usersResponse, permissionsResponse] = await Promise.all([
          fetch('/api/admin/metrics'),
          fetch('/api/admin/users'),
          fetch('/api/admin/permissions'),
        ]);

        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          setMetrics(metricsData);
        }

        if (permissionsResponse.ok) {
          const permissionsData = await permissionsResponse.json();
          const matrix = permissionsData.permissions;
          if (matrix?.roles) {
            setRoleAccess(matrix.roles);
          }
          if (matrix?.assignments) {
            setRoleAssignments(
              matrix.assignments.reduce((acc: Record<string, RoleKey>, assignment: { userId: string; role: RoleKey }) => {
                acc[assignment.userId] = assignment.role;
                return acc;
              }, {})
            );
          }
        }

        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setUsers(usersData.users || []);
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Get system health color
  const getSystemHealthColor = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }, []);

  // Get system health icon
  const getSystemHealthIcon = useCallback((status: string) => {
    switch (status) {
      case 'healthy': return '✓';
      case 'warning': return '⚠';
      case 'error': return '✗';
      default: return '?';
    }
  }, []);

  // Format date
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, monitor system health, and view analytics</p>
        </div>
        <div className="flex flex-col gap-2">
          {successMessage && (
            <div className="inline-flex items-center gap-2 px-3 py-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex flex-wrap gap-4 text-sm font-medium text-gray-500">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: 'Users' },
            { id: 'permissions', label: 'Permissions' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'system', label: 'System' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative pb-2 transition-colors ${
                activeTab === tab.id ? 'text-blue-600' : 'hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span
                className={`absolute left-0 right-0 bottom-0 h-0.5 rounded-full transition-opacity ${
                  activeTab === tab.id ? 'bg-blue-500 opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.activeUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalEvents}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Searches</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalSearches}</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getSystemHealthColor(metrics.systemHealth.status)}`}>
                  {getSystemHealthIcon(metrics.systemHealth.status)}
                </div>
                <p className="text-sm text-gray-600 mt-2">Status</p>
                <p className="font-medium capitalize">{metrics.systemHealth.status}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {Math.round(metrics.systemHealth.uptime)}%
                </div>
                <p className="text-sm text-gray-600 mt-2">Uptime</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {metrics.systemHealth.responseTime}ms
                </div>
                <p className="text-sm text-gray-600 mt-2">Response Time</p>
              </div>
            </div>
          </div>

          {/* User Growth */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Growth</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{metrics.userGrowth.daily}</div>
                <p className="text-sm text-gray-600 mt-2">New Users Today</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{metrics.userGrowth.weekly}</div>
                <p className="text-sm text-gray-600 mt-2">New Users This Week</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{metrics.userGrowth.monthly}</div>
                <p className="text-sm text-gray-600 mt-2">New Users This Month</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
            <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Sign In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => {
                  const currentRole = roleAssignments[user.id] || 'Seller';
                  const pendingRole = pendingRoleAssignments[user.id] || currentRole;
                  const isSaving = savingAssignments[user.id];
                  return (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          <div className="text-sm text-gray-500">ID: {user.id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <select
                            value={pendingRole}
                            onChange={(e) => setPendingRoleAssignments((prev) => ({
                              ...prev,
                              [user.id]: e.target.value as RoleKey,
                            }))}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button
                            onClick={async () => {
                              const role = pendingRoleAssignments[user.id] || currentRole;
                              setSavingAssignments((prev) => ({ ...prev, [user.id]: true }));
                              setSuccessMessage(null);
                              setErrorMessage(null);
                              try {
                                const response = await fetch('/api/admin/permissions', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ roles: [{ userId: user.id, role }] }),
                                });
                                if (!response.ok) throw new Error(await response.text());
                                setSuccessMessage(`Updated ${user.email} to ${role}`);
                                setPendingRoleAssignments((prev) => {
                                  const next = { ...prev };
                                  delete next[user.id];
                                  return next;
                                });
                                setRoleAssignments((prev) => ({ ...prev, [user.id]: role }));
                              } catch (error) {
                                setErrorMessage(error instanceof Error ? error.message : 'Failed to update role');
                              } finally {
                                setSavingAssignments((prev) => {
                                  const next = { ...prev };
                                  delete next[user.id];
                                  return next;
                                });
                              }
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                              isSaving ? 'text-blue-400 cursor-wait' : 'text-blue-600 hover:text-blue-700'
                            }`}
                            disabled={isSaving}
                          >
                            {isSaving ? 'Updating…' : 'Update'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && metrics && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{metrics.eventStats.collected}</div>
                <p className="text-sm text-gray-600 mt-2">Events Collected</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{metrics.eventStats.processed}</div>
                <p className="text-sm text-gray-600 mt-2">Events Processed</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{metrics.eventStats.errors}</div>
                <p className="text-sm text-gray-600 mt-2">Processing Errors</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Analytics</h2>
            <div className="text-center py-8">
              <p className="text-gray-500">Search analytics will be displayed here</p>
            </div>
          </div>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && metrics && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">System Monitoring</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Performance Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Response Time</span>
                    <span className="text-sm font-medium">{metrics.systemHealth.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Error Rate</span>
                    <span className="text-sm font-medium">{metrics.systemHealth.errorRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Uptime</span>
                    <span className="text-sm font-medium">{Math.round(metrics.systemHealth.uptime)}%</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">System Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database</span>
                    <span className="text-sm font-medium text-green-600">✓ Healthy</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Services</span>
                    <span className="text-sm font-medium text-green-600">✓ Healthy</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">External APIs</span>
                    <span className="text-sm font-medium text-green-600">✓ Healthy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Module Access Matrix</h2>
                <p className="text-gray-600 mt-1">Control which roles can see and use each module</p>
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Live preview (mock)
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Module
                    </th>
                    {ROLE_OPTIONS.map((role) => (
                      <th key={role} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {role}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {MODULES.map((module) => (
                    <tr key={module.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div>{module.label}</div>
                        <p className="text-xs text-gray-500 mt-1">Controls access to {module.label.toLowerCase()} surfaces.</p>
                      </td>
                      {ROLE_OPTIONS.map((role) => (
                        <td key={`${module.id}-${role}`} className="px-6 py-4 text-center">
                          <label className="inline-flex items-center justify-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={roleAccess[role][module.id as keyof RoleAccess]}
                              onChange={(e) => {
                                setSuccessMessage(null);
                                setErrorMessage(null);
                                setRoleAccess((prev) => ({
                                  ...prev,
                                  [role]: {
                                    ...prev[role],
                                    [module.id]: e.target.checked,
                                  },
                                }));
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-gray-500">
                Changes sync to Supabase permissions. Connect SSO for real-time propagation.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRoleAccess(defaultPermissions().roles);
                    setSuccessMessage('Module access reset to defaults');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Reset defaults
                </button>
                <button
                  onClick={async () => {
                    setSavingMatrix(true);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    try {
                      const payload = Object.entries(roleAccess).flatMap(([role, access]) =>
                        Object.entries(access).map(([moduleId, enabled]) => ({
                          role: role as RoleKey,
                          moduleId: moduleId as ModuleId,
                          enabled,
                        }))
                      );

                      const response = await fetch('/api/admin/permissions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ modules: payload }),
                      });

                      if (!response.ok) throw new Error(await response.text());
                      setSuccessMessage('Permissions saved successfully');
                    } catch (error) {
                      setErrorMessage(error instanceof Error ? error.message : 'Failed to save permissions');
                    } finally {
                      setSavingMatrix(false);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition-colors ${
                    savingMatrix ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={savingMatrix}
                >
                  {savingMatrix ? 'Saving…' : 'Save configuration'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Role Assignment</h2>
              <p className="text-gray-600 mt-1">Assign users to roles that determine their navigation and data access</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Sign In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => {
                    const currentRole = roleAssignments[user.id] || 'Seller';
                    const pendingRole = pendingRoleAssignments[user.id] || currentRole;
                    const isSaving = savingAssignments[user.id];
                    return (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.email}</div>
                            <div className="text-sm text-gray-500">ID: {user.id}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="text-xs text-gray-500">
                              Current: <span className="font-semibold text-gray-700">{currentRole}</span>
                            </div>
                            <select
                              value={pendingRole}
                              onChange={(e) => {
                                setSuccessMessage(null);
                                setErrorMessage(null);
                                setPendingRoleAssignments((prev) => ({
                                  ...prev,
                                  [user.id]: e.target.value as RoleKey,
                                }));
                              }}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                            <button
                              onClick={async () => {
                                const role = pendingRoleAssignments[user.id] || currentRole;
                                setSavingAssignments((prev) => ({ ...prev, [user.id]: true }));
                                setSuccessMessage(null);
                                setErrorMessage(null);
                                try {
                                  const response = await fetch('/api/admin/permissions', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ roles: [{ userId: user.id, role }] }),
                                  });
                                  if (!response.ok) throw new Error(await response.text());
                                  setSuccessMessage(`Updated ${user.email} to ${role}`);
                                  setPendingRoleAssignments((prev) => {
                                    const next = { ...prev };
                                    delete next[user.id];
                                    return next;
                                  });
                                  setRoleAssignments((prev) => ({ ...prev, [user.id]: role }));
                                } catch (error) {
                                  setErrorMessage(error instanceof Error ? error.message : 'Failed to update role');
                                } finally {
                                  setSavingAssignments((prev) => {
                                    const next = { ...prev };
                                    delete next[user.id];
                                    return next;
                                  });
                                }
                              }}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                isSaving ? 'text-blue-400 cursor-wait' : 'text-blue-600 hover:text-blue-700'
                              }`}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Updating…' : 'Update'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-gray-200 text-xs text-gray-500">
              SSO integration (mock) required to propagate changes immediately. Otherwise, updates apply on next login.
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AdminDashboard;
