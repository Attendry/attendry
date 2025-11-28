/**
 * PHASE 2: Discovery Profile Setup Wizard
 * 
 * Multi-step wizard for creating a user's discovery profile.
 * Guides users through setting up industries, regions, ICP, watchlist, etc.
 */

"use client";

import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Building2, 
  MapPin, 
  Users, 
  Target,
  AlertTriangle,
  Bell,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { triggerSmartBackfillOnProfileCreation } from '@/lib/services/smart-backfill-service';

interface WizardData {
  industries: string[];
  regions: string[];
  target_titles: string[];
  target_companies: string[];
  competitors: string[];
  discovery_frequency: 'hourly' | 'daily' | 'weekly';
  enable_critical_alerts: boolean;
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

interface DiscoveryProfileWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export default function DiscoveryProfileWizard({
  onComplete,
  onCancel
}: DiscoveryProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<WizardData>({
    industries: [],
    regions: [],
    target_titles: [],
    target_companies: [],
    competitors: [],
    discovery_frequency: 'daily',
    enable_critical_alerts: true
  });

  const totalSteps = 6;

  const updateData = (updates: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const toggleArrayItem = (array: string[], item: string): string[] => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (data.industries.length === 0) {
      toast.error('Please select at least one industry');
      return;
    }
    if (data.regions.length === 0) {
      toast.error('Please select at least one region');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/discovery-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to create discovery profile');
      }

      // Trigger smart backfill
      const { data: { user } } = await (await import('@/lib/supabase-browser')).supabaseBrowser().auth.getUser();
      if (user) {
        await triggerSmartBackfillOnProfileCreation(user.id);
      }

      toast.success('Discovery profile created! Finding opportunities...');
      onComplete();
    } catch (error) {
      toast.error('Failed to create discovery profile');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Select Industries</h2>
            <p className="text-gray-600 mb-6">
              Which industries are you interested in? We'll discover events in these sectors.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {INDUSTRIES.map(industry => (
                <button
                  key={industry}
                  onClick={() => updateData({ industries: toggleArrayItem(data.industries, industry) })}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    data.industries.includes(industry)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{industry}</span>
                    {data.industries.includes(industry) && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Select Regions</h2>
            <p className="text-gray-600 mb-6">
              Which regions should we focus on? Select countries where you want to discover events.
            </p>
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {REGIONS.map(region => (
                <button
                  key={region}
                  onClick={() => updateData({ regions: toggleArrayItem(data.regions, region) })}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    data.regions.includes(region)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{region}</span>
                    {data.regions.includes(region) && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Target Titles (ICP)</h2>
            <p className="text-gray-600 mb-6">
              What job titles are you targeting? We'll match speakers with these titles.
            </p>
            <div className="space-y-3 mb-4">
              {COMMON_TITLES.map(title => (
                <button
                  key={title}
                  onClick={() => updateData({ target_titles: toggleArrayItem(data.target_titles, title) })}
                  className={`w-full p-3 border-2 rounded-lg text-left transition-colors ${
                    data.target_titles.includes(title)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{title}</span>
                    {data.target_titles.includes(title) && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Add Custom Title</label>
              <input
                type="text"
                placeholder="e.g., Chief Privacy Officer"
                className="w-full p-2 border rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    updateData({
                      target_titles: [...data.target_titles, e.currentTarget.value.trim()]
                    });
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Target Companies (Watchlist)</h2>
            <p className="text-gray-600 mb-6">
              Which companies are you targeting? We'll alert you when we find them at events.
            </p>
            <div className="space-y-3 mb-4">
              {data.target_companies.map((company, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>{company}</span>
                  <button
                    onClick={() => updateData({
                      target_companies: data.target_companies.filter((_, i) => i !== idx)
                    })}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Add Company</label>
              <input
                type="text"
                placeholder="e.g., Microsoft, Google, Apple"
                className="w-full p-2 border rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    updateData({
                      target_companies: [...data.target_companies, e.currentTarget.value.trim()]
                    });
                    e.currentTarget.value = '';
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Press Enter to add. You can add multiple companies.
              </p>
            </div>
          </div>
        );

      case 5:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Competitors</h2>
            <p className="text-gray-600 mb-6">
              Which companies are your competitors? We'll track their presence at events.
            </p>
            <div className="space-y-3 mb-4">
              {data.competitors.map((competitor, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span>{competitor}</span>
                  <button
                    onClick={() => updateData({
                      competitors: data.competitors.filter((_, i) => i !== idx)
                    })}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Add Competitor</label>
              <input
                type="text"
                placeholder="e.g., Competitor Name"
                className="w-full p-2 border rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    updateData({
                      competitors: [...data.competitors, e.currentTarget.value.trim()]
                    });
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Discovery Settings</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Discovery Frequency</label>
                <select
                  value={data.discovery_frequency}
                  onChange={(e) => updateData({ discovery_frequency: e.target.value as any })}
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
                    checked={data.enable_critical_alerts}
                    onChange={(e) => updateData({ enable_critical_alerts: e.target.checked })}
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Set Up Discovery Profile</h1>
              <p className="text-sm text-gray-600 mt-1">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Complete Setup'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


