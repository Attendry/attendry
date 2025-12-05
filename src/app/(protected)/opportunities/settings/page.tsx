/**
 * PHASE 2: Discovery Profile Settings Page
 * 
 * Allows users to view and edit their discovery profile settings:
 * - Industries, regions, target titles, target companies, competitors
 * - Discovery frequency and alert preferences
 */

"use client";

import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Save, 
  Building2, 
  MapPin, 
  Users, 
  Target,
  AlertTriangle,
  Bell,
  CheckCircle2,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DiscoveryProfile {
  id: string;
  user_id: string;
  industries: string[];
  event_types: string[];
  regions: string[];
  date_range_days: number;
  target_titles: string[];
  target_companies: string[];
  competitors: string[];
  discovery_frequency: 'hourly' | 'daily' | 'weekly';
  min_relevance_score: number;
  enable_critical_alerts: boolean;
  created_at: string;
  updated_at: string;
}

const INDUSTRIES = [
  'Legal & Compliance',
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Energy',
  'Education',
  'Government',
  'Non-Profit'
];

const REGIONS = [
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Canada',
  'Australia',
  'Netherlands',
  'Switzerland',
  'Sweden',
  'Norway',
  'Denmark',
  'Belgium',
  'Austria',
  'Spain',
  'Italy'
];

const COMMON_TITLES = [
  'General Counsel',
  'Chief Compliance Officer',
  'Chief Legal Officer',
  'VP of Legal',
  'Head of Compliance',
  'Privacy Officer',
  'Data Protection Officer',
  'Chief Technology Officer',
  'VP of Engineering',
  'Chief Information Officer'
];

export default function DiscoveryProfileSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [industries, setIndustries] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [targetTitles, setTargetTitles] = useState<string[]>([]);
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [discoveryFrequency, setDiscoveryFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [enableCriticalAlerts, setEnableCriticalAlerts] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');

  // Auth setup
  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUserId(data.session?.user?.id ?? null);
        setAuthReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setUserId(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Load profile
  useEffect(() => {
    if (authReady && userId) {
      loadProfile();
    }
  }, [authReady, userId]);

  const loadProfile = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch('/api/discovery-profiles');
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          setProfile(data.profile);
          setIndustries(data.profile.industries || []);
          setRegions(data.profile.regions || []);
          setTargetTitles(data.profile.target_titles || []);
          setTargetCompanies(data.profile.target_companies || []);
          setCompetitors(data.profile.competitors || []);
          setDiscoveryFrequency(data.profile.discovery_frequency || 'daily');
          setEnableCriticalAlerts(data.profile.enable_critical_alerts ?? true);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load discovery profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    // Validate
    if (industries.length === 0) {
      toast.error('Please select at least one industry');
      return;
    }
    if (regions.length === 0) {
      toast.error('Please select at least one region');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/discovery-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industries,
          regions,
          target_titles: targetTitles,
          target_companies: targetCompanies,
          competitors,
          discovery_frequency: discoveryFrequency,
          enable_critical_alerts: enableCriticalAlerts
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      toast.success('Discovery profile updated successfully');
      loadProfile(); // Reload to get updated data
    } catch (error) {
      toast.error('Failed to save discovery profile');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (array: string[], item: string, setter: (arr: string[]) => void) => {
    setter(array.includes(item) ? array.filter(i => i !== item) : [...array, item]);
  };

  const addCustomItem = (value: string, array: string[], setter: (arr: string[]) => void, clearInput: () => void) => {
    if (value.trim() && !array.includes(value.trim())) {
      setter([...array, value.trim()]);
      clearInput();
    }
  };

  const removeItem = (array: string[], item: string, setter: (arr: string[]) => void) => {
    setter(array.filter(i => i !== item));
  };

  if (!authReady) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">Sign in required</h2>
        <p>
          <a href="/login" className="text-blue-600 hover:text-blue-700">
            Go to sign in
          </a>{' '}
          to manage your discovery profile.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading discovery profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">No Discovery Profile</h2>
        <p className="text-gray-600 mb-4">
          You don't have a discovery profile yet. Create one to start discovering opportunities.
        </p>
        <button
          onClick={() => router.push('/opportunities')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go to Opportunities
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold mb-2">Discovery Profile Settings</h1>
        <p className="text-gray-600">
          Manage your discovery preferences: industries, regions, target accounts, and more
        </p>
      </div>

      {/* Industries Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Industries</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {INDUSTRIES.map(industry => (
            <button
              key={industry}
              onClick={() => toggleArrayItem(industries, industry, setIndustries)}
              className={`p-3 border-2 rounded-lg text-left transition-colors ${
                industries.includes(industry)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{industry}</span>
                {industries.includes(industry) && (
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Regions Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Regions</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {REGIONS.map(region => (
            <button
              key={region}
              onClick={() => toggleArrayItem(regions, region, setRegions)}
              className={`p-3 border-2 rounded-lg text-left transition-colors ${
                regions.includes(region)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{region}</span>
                {regions.includes(region) && (
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Target Titles (ICP) Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Target Titles (ICP)</h2>
        </div>
        <div className="space-y-3 mb-4">
          {targetTitles.map((title, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span>{title}</span>
              <button
                onClick={() => removeItem(targetTitles, title, setTargetTitles)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-3 mb-4">
          {COMMON_TITLES.filter(t => !targetTitles.includes(t)).map(title => (
            <button
              key={title}
              onClick={() => setTargetTitles([...targetTitles, title])}
              className="w-full p-3 border-2 border-gray-200 rounded-lg text-left hover:border-gray-300 transition-colors"
            >
              + {title}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Add Custom Title</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Chief Privacy Officer"
              className="flex-1 p-2 border rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addCustomItem(newTitle, targetTitles, setTargetTitles, () => setNewTitle(''));
                }
              }}
            />
            <button
              onClick={() => addCustomItem(newTitle, targetTitles, setTargetTitles, () => setNewTitle(''))}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Target Companies (Watchlist) Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Target Companies (Watchlist)</h2>
        </div>
        <div className="space-y-2 mb-4">
          {targetCompanies.map((company, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span>{company}</span>
              <button
                onClick={() => removeItem(targetCompanies, company, setTargetCompanies)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Add Company</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              placeholder="e.g., Microsoft, Google, Apple"
              className="flex-1 p-2 border rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addCustomItem(newCompany, targetCompanies, setTargetCompanies, () => setNewCompany(''));
                }
              }}
            />
            <button
              onClick={() => addCustomItem(newCompany, targetCompanies, setTargetCompanies, () => setNewCompany(''))}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Competitors Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h2 className="text-xl font-semibold">Competitors</h2>
        </div>
        <div className="space-y-2 mb-4">
          {competitors.map((competitor, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span>{competitor}</span>
              <button
                onClick={() => removeItem(competitors, competitor, setCompetitors)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Add Competitor</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              placeholder="e.g., Competitor Name"
              className="flex-1 p-2 border rounded-lg"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addCustomItem(newCompetitor, competitors, setCompetitors, () => setNewCompetitor(''));
                }
              }}
            />
            <button
              onClick={() => addCustomItem(newCompetitor, competitors, setCompetitors, () => setNewCompetitor(''))}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Discovery Settings Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Discovery Settings</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Discovery Frequency</label>
            <select
              value={discoveryFrequency}
              onChange={(e) => setDiscoveryFrequency(e.target.value as any)}
              className="w-full p-2 border rounded-lg"
            >
              <option value="hourly">Hourly (Most frequent)</option>
              <option value="daily">Daily (Recommended)</option>
              <option value="weekly">Weekly (Less frequent)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How often should we discover new opportunities for you?
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableCriticalAlerts}
                onChange={(e) => setEnableCriticalAlerts(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Enable Critical Alerts</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Get email/Slack notifications when we find high-confidence matches from your watchlist
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}



