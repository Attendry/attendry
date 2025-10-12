/**
 * Intelligence Dashboard Component
 * 
 * Main dashboard for Market Intelligence feature with Account Intelligence
 * and Competitor Intelligence sections.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Users, 
  TrendingUp, 
  Calendar, 
  Search, 
  Plus,
  Eye,
  BarChart3,
  Target,
  Globe,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface Account {
  id: string;
  company_name: string;
  domain?: string;
  industry?: string;
  description?: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
}

interface AccountSummary {
  account_id: string;
  account_name: string;
  account_domain?: string;
  account_industry?: string;
  total_speakers: number;
  total_intelligence_data: number;
  latest_activity: string;
  confidence_avg: number;
}

interface IntelligenceStats {
  totalAccounts: number;
  totalSpeakers: number;
  totalEvents: number;
  recentActivity: number;
}

export default function IntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'competitors'>('accounts');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [stats, setStats] = useState<IntelligenceStats>({
    totalAccounts: 0,
    totalSpeakers: 0,
    totalEvents: 0,
    recentActivity: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load accounts
      const accountsResponse = await fetch('/api/intelligence/accounts');
      const accountsData = await accountsResponse.json();
      
      if (accountsData.accounts) {
        setAccounts(accountsData.accounts);
        setStats(prev => ({
          ...prev,
          totalAccounts: accountsData.accounts.length
        }));
      }

      // Load account summaries
      const summaries = await Promise.all(
        accountsData.accounts.map(async (account: Account) => {
          try {
            const summaryResponse = await fetch(`/api/intelligence/accounts/${account.id}`);
            const summaryData = await summaryResponse.json();
            return summaryData.summary;
          } catch (error) {
            console.error(`Failed to load summary for account ${account.id}:`, error);
            return null;
          }
        })
      );

      const validSummaries = summaries.filter(Boolean);
      setAccountSummaries(validSummaries);

      // Calculate stats
      const totalSpeakers = validSummaries.reduce((sum, s) => sum + s.total_speakers, 0);
      const totalIntelligenceData = validSummaries.reduce((sum, s) => sum + s.total_intelligence_data, 0);
      
      setStats(prev => ({
        ...prev,
        totalSpeakers,
        totalEvents: totalIntelligenceData,
        recentActivity: validSummaries.filter(s => {
          const daysSinceActivity = (Date.now() - new Date(s.latest_activity).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceActivity <= 7;
        }).length
      }));

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = !searchTerm || 
      account.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.domain?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesIndustry = !selectedIndustry || account.industry === selectedIndustry;
    
    return matchesSearch && matchesIndustry;
  });

  const industries = Array.from(new Set(accounts.map(a => a.industry).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading Intelligence Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Market Intelligence</h1>
          <p className="text-muted-foreground">
            Monitor accounts and competitors for strategic insights
          </p>
        </div>
        <Button onClick={() => {/* TODO: Open add account modal */}}>
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAccounts}</div>
            <p className="text-xs text-muted-foreground">
              Companies being monitored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Speakers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSpeakers}</div>
            <p className="text-xs text-muted-foreground">
              Identified company speakers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Event Insights</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              Intelligence data points
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recentActivity}</div>
            <p className="text-xs text-muted-foreground">
              Active in last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList>
          <TabsTrigger value="accounts">Account Intelligence</TabsTrigger>
          <TabsTrigger value="competitors">Competitor Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">All Industries</option>
              {industries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map(account => {
              const summary = accountSummaries.find(s => s.account_id === account.id);
              return (
                <AccountCard
                  key={account.id}
                  account={account}
                  summary={summary}
                />
              );
            })}
          </div>

          {filteredAccounts.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No accounts found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchTerm || selectedIndustry 
                    ? 'Try adjusting your search criteria'
                    : 'Get started by adding your first account to monitor'
                  }
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Competitor Intelligence</CardTitle>
              <CardDescription>
                Analyze competitor activity and market positioning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-muted-foreground text-center">
                  Competitor intelligence features are in development
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AccountCardProps {
  account: Account;
  summary?: AccountSummary;
}

function AccountCard({ account, summary }: AccountCardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      // TODO: Trigger analysis
      console.log('Analyzing account:', account.id);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{account.company_name}</CardTitle>
            {account.domain && (
              <CardDescription className="flex items-center mt-1">
                <Globe className="h-3 w-3 mr-1" />
                {account.domain}
              </CardDescription>
            )}
          </div>
          {summary && (
            <Badge className={getConfidenceColor(summary.confidence_avg)}>
              {Math.round(summary.confidence_avg * 100)}% confidence
            </Badge>
          )}
        </div>
        {account.industry && (
          <Badge variant="outline">{account.industry}</Badge>
        )}
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{summary.total_speakers} speakers</span>
              </div>
              <div className="flex items-center">
                <BarChart3 className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{summary.total_intelligence_data} insights</span>
              </div>
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-2" />
              <span>
                Last activity: {new Date(summary.latest_activity).toLocaleDateString()}
              </span>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'View Details'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span>No data available</span>
            </div>
            <Button size="sm" className="w-full" onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
