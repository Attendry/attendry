/**
 * Enhanced Profile Manager Component
 * Handles profile suggestions, primary profile selection, and custom profile creation
 */

import React, { useState, useEffect } from 'react';

interface ProfileSuggestion {
  id: string;
  name: string;
  industry: string;
  country: string;
  industryTerms: string[];
  icpTerms: string[];
  competitors: string[];
  description: string;
  confidence: number;
}

interface ProfileManagerProps {
  onProfileSelect: (profile: ProfileSuggestion) => void;
  onCustomProfileCreate: () => void;
  currentProfile?: any;
}

export function ProfileManager({ 
  onProfileSelect, 
  onCustomProfileCreate, 
  currentProfile 
}: ProfileManagerProps) {
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [loading, setLoading] = useState(false);

  // Mock profile suggestions - in real implementation, these would come from an API
  const mockSuggestions: ProfileSuggestion[] = [
    {
      id: 'legal-compliance-de',
      name: 'Legal & Compliance Professional',
      industry: 'legal-compliance',
      country: 'DE',
      industryTerms: ['compliance', 'legal tech', 'regulatory', 'governance', 'risk management', 'audit', 'investigation', 'e-discovery', 'GDPR', 'privacy'],
      icpTerms: ['general counsel', 'compliance officer', 'legal counsel', 'risk manager', 'audit manager', 'data protection officer'],
      competitors: ['Epiq', 'Relativity', 'OpenText', 'Microsoft', 'IBM'],
      description: 'Focused on legal technology, compliance, and regulatory events in Germany',
      confidence: 0.95
    },
    {
      id: 'fintech-de',
      name: 'FinTech & Financial Services',
      industry: 'fintech',
      country: 'DE',
      industryTerms: ['fintech', 'banking innovation', 'digital banking', 'payment systems', 'blockchain', 'cryptocurrency', 'regtech', 'insurtech'],
      icpTerms: ['fintech executive', 'banking executive', 'payment executive', 'blockchain executive', 'financial services executive'],
      competitors: ['N26', 'Revolut', 'Klarna', 'Stripe', 'Adyen'],
      description: 'Focused on financial technology and banking innovation events in Germany',
      confidence: 0.88
    },
    {
      id: 'healthcare-de',
      name: 'Healthcare & Medical Technology',
      industry: 'healthcare',
      country: 'DE',
      industryTerms: ['healthcare', 'medical technology', 'health innovation', 'digital health', 'telemedicine', 'healthcare IT', 'medical devices', 'pharmaceutical'],
      icpTerms: ['healthcare executive', 'medical director', 'healthcare IT director', 'pharmaceutical executive', 'biotech executive'],
      competitors: ['Siemens Healthineers', 'Fresenius', 'Bayer', 'Merck', 'Boehringer Ingelheim'],
      description: 'Focused on healthcare innovation and medical technology events in Germany',
      confidence: 0.82
    }
  ];

  const countries = [
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'AT', name: 'Austria' },
    { code: 'CH', name: 'Switzerland' }
  ];

  useEffect(() => {
    // Filter suggestions by selected country
    const filteredSuggestions = mockSuggestions.map(suggestion => ({
      ...suggestion,
      country: selectedCountry,
      id: `${suggestion.industry}-${selectedCountry.toLowerCase()}`,
      description: suggestion.description.replace('Germany', countries.find(c => c.code === selectedCountry)?.name || 'Germany')
    }));
    setSuggestions(filteredSuggestions);
  }, [selectedCountry]);

  const handleProfileSelect = (profile: ProfileSuggestion) => {
    onProfileSelect(profile);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.8) return 'text-blue-600 bg-blue-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'Excellent Match';
    if (confidence >= 0.8) return 'Good Match';
    if (confidence >= 0.7) return 'Fair Match';
    return 'Low Match';
  };

  return (
    <div className="space-y-6">
      {/* Country Selection */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-lg font-medium text-slate-900 mb-3">Select Country</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {countries.map(country => (
            <button
              key={country.code}
              onClick={() => setSelectedCountry(country.code)}
              className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                selectedCountry === country.code
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-gray-200 hover:border-gray-300'
              }`}
            >
              {country.name}
            </button>
          ))}
        </div>
      </div>

      {/* Profile Suggestions */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-slate-900">Suggested Profiles</h3>
          <span className="text-sm text-slate-500">Based on your activity and preferences</span>
        </div>

        <div className="space-y-4">
          {suggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{suggestion.name}</h4>
                  <p className="text-sm text-slate-600 mt-1">{suggestion.description}</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                  {getConfidenceLabel(suggestion.confidence)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <h5 className="text-sm font-medium text-slate-700 mb-1">Industry Terms</h5>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.industryTerms.slice(0, 5).map(term => (
                      <span key={term} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {term}
                      </span>
                    ))}
                    {suggestion.industryTerms.length > 5 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{suggestion.industryTerms.length - 5} more
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-slate-700 mb-1">Target Audience</h5>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.icpTerms.slice(0, 3).map(term => (
                      <span key={term} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                        {term}
                      </span>
                    ))}
                    {suggestion.icpTerms.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{suggestion.icpTerms.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-medium text-slate-700 mb-1">Competitors</h5>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.competitors.slice(0, 3).map(competitor => (
                      <span key={competitor} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        {competitor}
                      </span>
                    ))}
                    {suggestion.competitors.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        +{suggestion.competitors.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  <span className="font-medium">Confidence:</span> {Math.round(suggestion.confidence * 100)}%
                </div>
                <button
                  onClick={() => handleProfileSelect(suggestion)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Set as Primary Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Profile Creation */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-slate-900">Create Custom Profile</h3>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Build a profile from scratch with your specific industry terms, target audience, and competitors.
        </p>
        <button
          onClick={onCustomProfileCreate}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          Create Custom Profile
        </button>
      </div>

      {/* Current Profile Status */}
      {currentProfile && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <h3 className="text-lg font-medium text-green-900">Primary Profile Active</h3>
          </div>
          <p className="text-sm text-green-700">
            Your primary profile is being used for search queries and recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
