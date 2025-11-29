/**
 * Competitor History Chart Component
 * 
 * Enhancement 3: Displays historical competitor activity over time
 */

'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

interface CompetitorHistoryChartProps {
  competitorName: string;
  periodType?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

interface Snapshot {
  snapshotDate: string;
  eventCount: number;
  activityScore: number;
  growthRate: number;
}

export function CompetitorHistoryChart({
  competitorName,
  periodType = 'monthly'
}: CompetitorHistoryChartProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, [competitorName, periodType]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const response = await fetch(
        `/api/competitive-intelligence/history/${encodeURIComponent(competitorName)}?` +
        `periodType=${periodType}&` +
        `startDate=${startDate.toISOString()}&` +
        `endDate=${endDate.toISOString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to load history');
      }

      const data = await response.json();
      setSnapshots(data.snapshots || []);
      setTrends(data.trends || []);
    } catch (err: any) {
      console.error('Error loading history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-600">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>Error loading history: {error}</p>
        <button
          onClick={loadHistory}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No historical data available for {competitorName}</p>
        <p className="text-sm mt-1">Historical tracking will begin after snapshots are generated</p>
      </div>
    );
  }

  const maxEvents = Math.max(...snapshots.map(s => s.eventCount), 1);
  const maxScore = Math.max(...snapshots.map(s => s.activityScore), 1);

  return (
    <div className="space-y-4">
      {/* Trends Summary */}
      {trends.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Recent Trends</h4>
          {trends.slice(0, 3).map((trend, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 p-2 rounded ${
                trend.trendType === 'growth' || trend.trendType === 'spike'
                  ? 'bg-green-50 border border-green-200'
                  : trend.trendType === 'decline'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              {trend.trendType === 'growth' || trend.trendType === 'spike' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : trend.trendType === 'decline' ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : (
                <Minus className="h-4 w-4 text-gray-600" />
              )}
              <div className="flex-1">
                <div className="text-xs font-medium">{trend.description}</div>
                <div className="text-xs text-gray-600">
                  {new Date(trend.periodStart).toLocaleDateString()} - {new Date(trend.periodEnd).toLocaleDateString()}
                </div>
              </div>
              <div className={`text-xs font-semibold ${
                trend.changePercentage > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend.changePercentage > 0 ? '+' : ''}{trend.changePercentage.toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Chart */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Event Participation Over Time</h4>
        <div className="space-y-1">
          {snapshots.map((snapshot, idx) => {
            const width = (snapshot.eventCount / maxEvents) * 100;
            const date = new Date(snapshot.snapshotDate);
            
            return (
              <div key={idx} className="flex items-center gap-2">
                <div className="text-xs text-gray-600 w-20">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                  <div
                    className="bg-blue-600 h-4 rounded-full transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="text-xs font-medium w-12 text-right">
                  {snapshot.eventCount}
                </div>
                {snapshot.growthRate !== 0 && (
                  <div className={`text-xs w-16 text-right ${
                    snapshot.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {snapshot.growthRate > 0 ? '+' : ''}{snapshot.growthRate.toFixed(0)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity Score Chart */}
      <div>
        <h4 className="text-sm font-semibold mb-2">Activity Score</h4>
        <div className="space-y-1">
          {snapshots.map((snapshot, idx) => {
            const width = (snapshot.activityScore / maxScore) * 100;
            const date = new Date(snapshot.snapshotDate);
            
            return (
              <div key={idx} className="flex items-center gap-2">
                <div className="text-xs text-gray-600 w-20">
                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                  <div
                    className="bg-purple-600 h-4 rounded-full transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="text-xs font-medium w-12 text-right">
                  {snapshot.activityScore.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

