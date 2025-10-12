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

export const MarketIntelligenceStandalone = memo(() => {
  const [activeTab, setActiveTab] = useState<'recommendations' | 'accounts'>('recommendations');
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  
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

  const handleAddAccount = async (accountData: { company_name: string; domain?: string; industry?: string; description?: string }) => {
    try {
      const response = await fetch('/api/intelligence/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });

      if (response.ok) {
        // Reload account data
        await loadAccountData();
        setShowAddAccountModal(false);
      } else {
        console.error('Failed to add account');
      }
    } catch (error) {
      console.error('Error adding account:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Market Intelligence
            </h2>
            <p className="text-sm text-gray-600">
              Pipeline-ready event recommendations and strategic account monitoring
            </p>
          </div>
          {activeTab === 'accounts' && (
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Account
            </button>
          )}
        </div>

        {/* Demo Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <Brain className="h-5 w-5 text-blue-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Market Intelligence Demo</h3>
              <p className="text-sm text-blue-700">
                {activeTab === 'recommendations' 
                  ? "Explore AI-powered event recommendations with pipeline impact analysis and ICP segmentation."
                  : "Monitor strategic accounts, track speaker activity, and analyze event participation patterns."
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'recommendations'
                ? 'bg-blue-600 text-white'
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
                ? 'bg-blue-600 text-white'
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
        <div className="flex-1 overflow-hidden" key="recommendations-tab">
          <RecommendationEngine />
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="flex-1 overflow-y-auto" key="accounts-tab">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading Account Intelligence...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border bg-white border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Accounts
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.totalAccounts}
                      </p>
                    </div>
                    <Building2 className="h-8 w-8 text-gray-500" />
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-white border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Speakers
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.totalSpeakers}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-gray-500" />
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-white border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Event Insights
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.totalEvents}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-gray-500" />
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-white border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Recent Activity
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.recentActivity}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-gray-500" />
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="px-3 py-2 rounded-lg border bg-white border-gray-300 text-gray-900"
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
                <div className="p-8 rounded-lg border text-center bg-white border-gray-200">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                  <h3 className="text-lg font-semibold mb-2 text-gray-900">
                    No accounts found
                  </h3>
                  <p className="text-sm mb-4 text-gray-600">
                    {searchTerm || selectedIndustry 
                      ? 'Try adjusting your search criteria'
                      : 'Get started by adding your first account to monitor'
                    }
                  </p>
                  <button 
                    onClick={() => setShowAddAccountModal(true)}
                    className="px-4 py-2 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2 inline" />
                    Add Account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccountModal && (
        <AddAccountModal
          onClose={() => setShowAddAccountModal(false)}
          onAdd={handleAddAccount}
        />
      )}
    </div>
  );
});

MarketIntelligenceStandalone.displayName = 'MarketIntelligenceStandalone';

// Account Card Component
interface AccountCardProps {
  account: Account;
  summary?: AccountSummary;
}

const AccountCard = memo(({ account, summary }: AccountCardProps) => {
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
    <div className="p-4 rounded-lg border transition-shadow hover:shadow-md bg-white border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {account.company_name}
          </h3>
          {account.domain && (
            <div className="flex items-center mt-1 text-sm text-gray-600">
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
        <span className="inline-block px-2 py-1 text-xs rounded-full mb-3 bg-gray-100 text-gray-600">
          {account.industry}
        </span>
      )}

      {summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-2 text-gray-500" />
              <span className="text-gray-600">
                {summary.total_speakers} speakers
              </span>
            </div>
            <div className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-2 text-gray-500" />
              <span className="text-gray-600">
                {summary.total_intelligence_data} insights
              </span>
            </div>
          </div>
          
          <div className="flex items-center text-sm text-gray-500">
            <Clock className="h-4 w-4 mr-2" />
            <span>
              Last activity: {new Date(summary.latest_activity).toLocaleDateString()}
            </span>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
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
          <div className="flex items-center text-sm text-gray-500">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>No data available</span>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
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

// Add Account Modal Component
interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (accountData: { company_name: string; domain?: string; industry?: string; description?: string }) => void;
}

const AddAccountModal = memo(({ onClose, onAdd }: AddAccountModalProps) => {
  const [formData, setFormData] = useState({
    company_name: '',
    domain: '',
    industry: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd(formData);
      setFormData({ company_name: '', domain: '', industry: '', description: '' });
    } catch (error) {
      console.error('Error adding account:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add New Account</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Microsoft Corporation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain
            </label>
            <input
              type="text"
              name="domain"
              value={formData.domain}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. microsoft.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry
            </label>
            <select
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Industry</option>
              <option value="Technology">Technology</option>
              <option value="Financial Services">Financial Services</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Legal">Legal</option>
              <option value="Consulting">Consulting</option>
              <option value="Government">Government</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description of the company..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.company_name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
                  Adding...
                </>
              ) : (
                'Add Account'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

AddAccountModal.displayName = 'AddAccountModal';
