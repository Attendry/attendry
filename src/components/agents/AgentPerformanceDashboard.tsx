'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Mail,
  Clock,
  Sparkles,
  Target,
  BarChart3
} from 'lucide-react';

interface AgentPerformanceDashboardProps {
  agentId: string;
  agentType: string;
}

interface PerformanceData {
  summary: {
    tasksCompleted: number;
    tasksFailed: number;
    successRate: number;
    draftsCreated: number;
    draftsApproved: number;
    draftsRejected: number;
    approvalRate: number;
    messagesSent: number;
    responsesReceived: number;
    responseRate: number;
    avgTimeToDraft: number;
    opportunitiesIdentified: number;
  };
  chartData: Array<{
    date: string;
    tasksCompleted: number;
    tasksFailed: number;
    messagesSent: number;
    responsesReceived: number;
    responseRate: number;
    opportunitiesIdentified: number;
  }>;
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

const timeRanges = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: 365 }
];

export function AgentPerformanceDashboard({ agentId, agentType }: AgentPerformanceDashboardProps) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchPerformance();
  }, [agentId, timeRange]);

  const fetchPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/agents/${agentId}/performance?days=${timeRange}`);
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch performance data');
      }
      
      setData(result.performance);
    } catch (err: any) {
      setError(err.message || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">No Performance Data</h3>
        <p className="mt-2 text-sm text-slate-600">
          Performance metrics will appear here once your agent starts completing tasks.
        </p>
      </div>
    );
  }

  const { summary, chartData } = data;

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Metric Card Component
  const MetricCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend, 
    color = 'indigo' 
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: typeof CheckCircle2;
    trend?: 'up' | 'down' | 'neutral';
    color?: 'indigo' | 'green' | 'blue' | 'purple' | 'amber';
  }) => {
    const colorClasses = {
      indigo: 'bg-indigo-100 text-indigo-600',
      green: 'bg-green-100 text-green-600',
      blue: 'bg-blue-100 text-blue-600',
      purple: 'bg-purple-100 text-purple-600',
      amber: 'bg-amber-100 text-amber-600'
    };

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
            {subtitle && (
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <div className={`rounded-full p-3 ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center gap-1 text-xs">
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-4 w-4 text-red-600" />
            ) : null}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Performance Metrics</h3>
          <p className="text-sm text-slate-600">
            {data.period.startDate} to {data.period.endDate}
          </p>
        </div>
        <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                timeRange === range.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Tasks Completed"
          value={summary.tasksCompleted}
          subtitle={`${summary.successRate.toFixed(1)}% success rate`}
          icon={CheckCircle2}
          color="green"
          trend={summary.successRate > 80 ? 'up' : summary.successRate > 50 ? 'neutral' : 'down'}
        />
        <MetricCard
          title="Drafts Approved"
          value={summary.draftsApproved}
          subtitle={`${summary.approvalRate.toFixed(1)}% approval rate`}
          icon={Target}
          color="blue"
          trend={summary.approvalRate > 70 ? 'up' : summary.approvalRate > 50 ? 'neutral' : 'down'}
        />
        <MetricCard
          title="Response Rate"
          value={`${summary.responseRate.toFixed(1)}%`}
          subtitle={`${summary.responsesReceived} of ${summary.messagesSent} messages`}
          icon={Mail}
          color="purple"
          trend={summary.responseRate > 20 ? 'up' : summary.responseRate > 10 ? 'neutral' : 'down'}
        />
        {agentType === 'planning' ? (
          <MetricCard
            title="Opportunities"
            value={summary.opportunitiesIdentified}
            subtitle="Identified this period"
            icon={Sparkles}
            color="amber"
          />
        ) : (
          <MetricCard
            title="Avg. Time to Draft"
            value={`${summary.avgTimeToDraft.toFixed(1)}h`}
            subtitle="Average hours"
            icon={Clock}
            color="indigo"
            trend={summary.avgTimeToDraft < 2 ? 'up' : summary.avgTimeToDraft < 4 ? 'neutral' : 'down'}
          />
        )}
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="space-y-6">
          {/* Task Completion Trend */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-slate-900">Task Completion Trend</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px'
                  }}
                  labelFormatter={(value) => formatDate(value)}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="tasksCompleted"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                  name="Completed"
                />
                <Area
                  type="monotone"
                  dataKey="tasksFailed"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#colorFailed)"
                  name="Failed"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Messages & Responses */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-slate-900">Messages & Responses</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px'
                  }}
                  labelFormatter={(value) => formatDate(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="messagesSent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Messages Sent"
                />
                <Line
                  type="monotone"
                  dataKey="responsesReceived"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                  name="Responses Received"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Daily Activity Bar Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-slate-900">Daily Activity</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px'
                  }}
                  labelFormatter={(value) => formatDate(value)}
                />
                <Legend />
                <Bar dataKey="tasksCompleted" fill="#10b981" name="Tasks Completed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="messagesSent" fill="#3b82f6" name="Messages Sent" radius={[4, 4, 0, 0]} />
                {agentType === 'planning' && (
                  <Bar dataKey="opportunitiesIdentified" fill="#f59e0b" name="Opportunities" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Total Drafts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.draftsCreated}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              {summary.draftsApproved} approved
            </span>
            <span className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              {summary.draftsRejected} rejected
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Task Success Rate</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.successRate.toFixed(1)}%</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span>{summary.tasksCompleted} completed</span>
            <span>{summary.tasksFailed} failed</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Draft Approval Rate</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.approvalRate.toFixed(1)}%</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span>{summary.draftsApproved} approved</span>
            <span>{summary.draftsRejected} rejected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

