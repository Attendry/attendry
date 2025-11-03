import { useCallback, useEffect, useRef, useState } from 'react';

export interface Account {
  id: string;
  company_name: string;
  domain?: string;
  industry?: string;
  description?: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountSummary {
  account_id: string;
  account_name: string;
  account_domain?: string;
  account_industry?: string;
  total_speakers: number;
  total_intelligence_data: number;
  latest_activity: string;
  confidence_avg: number;
}

export interface IntelligenceStats {
  totalAccounts: number;
  totalSpeakers: number;
  totalEvents: number;
  recentActivity: number;
}

interface CreateAccountPayload {
  company_name: string;
  domain?: string;
  industry?: string;
  description?: string;
}

interface UseAccountIntelligenceDataReturn {
  accounts: Account[];
  summaries: AccountSummary[];
  stats: IntelligenceStats;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  addAccount: (payload: CreateAccountPayload) => Promise<void>;
}

export function useAccountIntelligenceData(): UseAccountIntelligenceDataReturn {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summaries, setSummaries] = useState<AccountSummary[]>([]);
  const [stats, setStats] = useState<IntelligenceStats>({
    totalAccounts: 0,
    totalSpeakers: 0,
    totalEvents: 0,
    recentActivity: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const accountsResponse = await fetch('/api/intelligence/accounts', {
        signal: controller.signal,
      });

      const accountsData = await accountsResponse.json();

      if (!accountsResponse.ok) {
        throw new Error(accountsData.error || 'Failed to load accounts');
      }

      const fetchedAccounts: Account[] = accountsData.accounts || [];
      setAccounts(fetchedAccounts);

      const summaries: AccountSummary[] = [];

      await Promise.all(
        fetchedAccounts.map(async (account) => {
          try {
            const summaryResponse = await fetch(`/api/intelligence/accounts/${account.id}`);
            const summaryData = await summaryResponse.json();

            if (summaryResponse.ok && summaryData?.summary) {
              summaries.push(summaryData.summary as AccountSummary);
            }
          } catch (err) {
            console.error(`Failed to load summary for account ${account.id}:`, err);
          }
        })
      );

      setSummaries(summaries);

      const totalSpeakers = summaries.reduce((sum, summary) => sum + summary.total_speakers, 0);
      const totalEvents = summaries.reduce((sum, summary) => sum + summary.total_intelligence_data, 0);
      const recentActivity = summaries.filter((summary) => {
        const latestActivity = summary.latest_activity ? new Date(summary.latest_activity).getTime() : 0;
        const daysSinceActivity = (Date.now() - latestActivity) / (1000 * 60 * 60 * 24);
        return latestActivity > 0 && daysSinceActivity <= 7;
      }).length;

      setStats({
        totalAccounts: fetchedAccounts.length,
        totalSpeakers,
        totalEvents,
        recentActivity,
      });
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') {
        return;
      }
      setError((err as Error).message || 'Failed to load account intelligence');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  const refresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const addAccount = useCallback(
    async (payload: CreateAccountPayload) => {
      const response = await fetch('/api/intelligence/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create account');
      }

      refresh();
    },
    [refresh]
  );

  return {
    accounts,
    summaries,
    stats,
    loading,
    error,
    refresh,
    addAccount,
  };
}


