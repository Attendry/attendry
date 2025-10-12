'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, memo } from 'react';
import { 
  Heart, 
  Star, 
  MapPin, 
  Calendar, 
  Users,
  TrendingUp,
  Clock,
  ExternalLink,
  Bookmark,
  Building2,
  Search,
  Plus,
  Eye,
  BarChart3,
  Target,
  Globe,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';

// Import the original RecommendationEngine for the Event Recommendations tab
import RecommendationEngine from '@/components/RecommendationEngine';

// Account Intelligence interfaces
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

// Event Recommendations interfaces (from original RecommendationEngine)
interface RecommendationEvent {
  id: string;
  title: string;
  source_url: string;
  starts_at: string;
  city: string;
  country: string;
  organizer: string;
  icpSegment?: string;
  accountTier?: 'Strategic' | 'Expansion' | 'New Market';
  attributedSource?: string;
  projectedPipelineImpact?: string;
  likelihood?: number;
}

interface Recommendation {
  id: string;
  type: 'similar_events' | 'trending_events' | 'industry_events' | 'location_based' | 'time_based' | 'collaborative';
  title: string;
  description: string;
  events: RecommendationEvent[];
  confidence: number;
  reason: string;
  icpSegment: string;
  source: string;
  likelihood: number;
  lastUpdated: string;
}

export const MarketIntelligenceModule = memo(() => {
  const { theme, updateUserBehavior, userBehavior } = useAdaptive();
  const [activeTab, setActiveTab] = useState<'recommendations' | 'accounts'>('recommendations');
  
  // Account Intelligence state
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

  // Load account intelligence data
  useEffect(() => {
    if (activeTab === 'accounts') {
      loadAccountData();
    }
  }, [activeTab]);

  const loadAccountData = async () => {
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
      console.error('Failed to load account data:', error);
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Market Intelligence
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Pipeline-ready event recommendations and strategic account monitoring
            </p>
          </div>
        </div>

        {/* AI Suggestion */}
        <SuggestionBanner
          suggestion={activeTab === 'recommendations' 
            ? (userBehavior.savedEvents > 0 
                ? `You've saved ${userBehavior.savedEvents} events! We've found similar ones you might like.`
                : "Start saving events you're interested in to get better personalized recommendations.")
            : (stats.totalAccounts > 0
                ? `Monitoring ${stats.totalAccounts} accounts with ${stats.totalSpeakers} identified speakers.`
                : "Add accounts to monitor for strategic insights and event participation.")
          }
          onAccept={() => {
            if (activeTab === 'recommendations' && userBehavior.savedEvents === 0) {
              // Could trigger a tutorial or guide
            } else if (activeTab === 'accounts' && stats.totalAccounts === 0) {
              // Could trigger account setup guide
            }
          }}
        />
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'recommendations'
                ? theme === 'dark'
                  ? 'bg-blue-600 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-100 text-blue-700'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : theme === 'high-contrast'
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Event Recommendations
            </div>
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'accounts'
                ? theme === 'dark'
                  ? 'bg-blue-600 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-100 text-blue-700'
                : theme === 'dark'
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : theme === 'high-contrast'
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Account Intelligence
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'recommendations' && (
        <div className="flex-1 overflow-hidden">
          <RecommendationEngine />
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading Account Intelligence...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900 border-gray-600'
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Total Accounts
                      </p>
                      <p className={`text-2xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {stats.totalAccounts}
                      </p>
                    </div>
                    <Building2 className={`h-8 w-8 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900 border-gray-600'
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Total Speakers
                      </p>
                      <p className={`text-2xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {stats.totalSpeakers}
                      </p>
                    </div>
                    <Users className={`h-8 w-8 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900 border-gray-600'
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Event Insights
                      </p>
                      <p className={`text-2xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {stats.totalEvents}
                      </p>
                    </div>
                    <Calendar className={`h-8 w-8 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                  </div>
                </div>

                <div className={`p-4 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900 border-gray-600'
                    : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Recent Activity
                      </p>
                      <p className={`text-2xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {stats.recentActivity}
                      </p>
                    </div>
                    <TrendingUp className={`h-8 w-8 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                          : theme === 'high-contrast'
                          ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-300'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    />
                  </div>
                </div>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className={`px-3 py-2 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : theme === 'high-contrast'
                      ? 'bg-gray-900 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
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
                      theme={theme}
                    />
                  );
                })}
              </div>

              {filteredAccounts.length === 0 && (
                <div className={`p-8 rounded-lg border text-center ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900 border-gray-600'
                    : 'bg-white border-gray-200'
                }`}>
                  <Building2 className={`h-12 w-12 mx-auto mb-4 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <h3 className={`text-lg font-semibold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    No accounts found
                  </h3>
                  <p className={`text-sm mb-4 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {searchTerm || selectedIndustry 
                      ? 'Try adjusting your search criteria'
                      : 'Get started by adding your first account to monitor'
                    }
                  </p>
                  <button className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : theme === 'high-contrast'
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}>
                    <Plus className="h-4 w-4 mr-2 inline" />
                    Add Account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

MarketIntelligenceModule.displayName = 'MarketIntelligenceModule';

// Account Card Component
interface AccountCardProps {
  account: Account;
  summary?: AccountSummary;
  theme: 'light' | 'dark' | 'high-contrast';
}

const AccountCard = memo(({ account, summary, theme }: AccountCardProps) => {
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
    <div className={`p-4 rounded-lg border transition-shadow hover:shadow-md ${
      theme === 'dark'
        ? 'bg-gray-800 border-gray-700'
        : theme === 'high-contrast'
        ? 'bg-gray-900 border-gray-600'
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {account.company_name}
          </h3>
          {account.domain && (
            <div className={`flex items-center mt-1 text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <Globe className="h-3 w-3 mr-1" />
              {account.domain}
            </div>
          )}
        </div>
        {summary && (
          <span className={`px-2 py-1 text-xs rounded-full ${getConfidenceColor(summary.confidence_avg)}`}>
            {Math.round(summary.confidence_avg * 100)}% confidence
          </span>
        )}
      </div>
      
      {account.industry && (
        <span className={`inline-block px-2 py-1 text-xs rounded-full mb-3 ${
          theme === 'dark'
            ? 'bg-gray-700 text-gray-300'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {account.industry}
        </span>
      )}

      {summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <Users className={`h-4 w-4 mr-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                {summary.total_speakers} speakers
              </span>
            </div>
            <div className="flex items-center">
              <BarChart3 className={`h-4 w-4 mr-2 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>
                {summary.total_intelligence_data} insights
              </span>
            </div>
          </div>
          
          <div className={`flex items-center text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <Clock className="h-4 w-4 mr-2" />
            <span>
              Last activity: {new Date(summary.latest_activity).toLocaleDateString()}
            </span>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600'
                : theme === 'high-contrast'
                ? 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-600'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400'
            }`}
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
            ) : (
              <Eye className="h-4 w-4 mr-2 inline" />
            )}
            {isAnalyzing ? 'Analyzing...' : 'View Details'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`flex items-center text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>No data available</span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600'
                : theme === 'high-contrast'
                ? 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-600'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400'
            }`}
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
            ) : (
              <Search className="h-4 w-4 mr-2 inline" />
            )}
            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
          </button>
        </div>
      )}
    </div>
  );
});

AccountCard.displayName = 'AccountCard';
