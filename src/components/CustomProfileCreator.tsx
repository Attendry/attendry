/**
 * Custom Profile Creator Component
 * Allows users to create profiles from scratch
 */

import React, { useState } from 'react';

interface CustomProfileCreatorProps {
  onProfileCreate: (profile: any) => void;
  onCancel: () => void;
  selectedCountry: string;
}

export function CustomProfileCreator({ 
  onProfileCreate, 
  onCancel, 
  selectedCountry 
}: CustomProfileCreatorProps) {
  const [profileName, setProfileName] = useState('');
  const [industry, setIndustry] = useState('');
  const [industryTerms, setIndustryTerms] = useState<string[]>([]);
  const [icpTerms, setIcpTerms] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [newIndustryTerm, setNewIndustryTerm] = useState('');
  const [newIcpTerm, setNewIcpTerm] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');

  const industries = [
    { id: 'legal-compliance', name: 'Legal & Compliance' },
    { id: 'fintech', name: 'FinTech & Financial Services' },
    { id: 'healthcare', name: 'Healthcare & Medical Technology' },
    { id: 'technology', name: 'Technology & Software' },
    { id: 'manufacturing', name: 'Manufacturing & Industrial' },
    { id: 'retail', name: 'Retail & E-commerce' },
    { id: 'education', name: 'Education & Training' },
    { id: 'consulting', name: 'Consulting & Professional Services' },
    { id: 'custom', name: 'Custom Industry' }
  ];

  const addIndustryTerm = () => {
    if (newIndustryTerm.trim() && !industryTerms.includes(newIndustryTerm.trim())) {
      setIndustryTerms([...industryTerms, newIndustryTerm.trim()]);
      setNewIndustryTerm('');
    }
  };

  const removeIndustryTerm = (term: string) => {
    setIndustryTerms(industryTerms.filter(t => t !== term));
  };

  const addIcpTerm = () => {
    if (newIcpTerm.trim() && !icpTerms.includes(newIcpTerm.trim())) {
      setIcpTerms([...icpTerms, newIcpTerm.trim()]);
      setNewIcpTerm('');
    }
  };

  const removeIcpTerm = (term: string) => {
    setIcpTerms(icpTerms.filter(t => t !== term));
  };

  const addCompetitor = () => {
    if (newCompetitor.trim() && !competitors.includes(newCompetitor.trim())) {
      setCompetitors([...competitors, newCompetitor.trim()]);
      setNewCompetitor('');
    }
  };

  const removeCompetitor = (competitor: string) => {
    setCompetitors(competitors.filter(c => c !== competitor));
  };

  const handleCreate = () => {
    if (!profileName.trim() || !industry || industryTerms.length === 0) {
      alert('Please fill in profile name, industry, and at least one industry term');
      return;
    }

    const profile = {
      id: `custom-${Date.now()}`,
      name: profileName.trim(),
      industry,
      country: selectedCountry,
      industryTerms,
      icpTerms,
      competitors,
      description: `Custom profile for ${profileName.trim()} in ${industries.find(i => i.id === industry)?.name || industry}`,
      confidence: 1.0,
      isCustom: true
    };

    onProfileCreate(profile);
  };

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-900">Create Custom Profile</h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Profile Name
          </label>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="e.g., My Legal Tech Profile"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Industry
          </label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an industry</option>
            {industries.map(ind => (
              <option key={ind.id} value={ind.id}>{ind.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Country
          </label>
          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-slate-600">
            {selectedCountry}
          </div>
        </div>
      </div>

      {/* Industry Terms */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Industry Terms
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newIndustryTerm}
            onChange={(e) => setNewIndustryTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addIndustryTerm()}
            placeholder="e.g., compliance, legal tech"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={addIndustryTerm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {industryTerms.map(term => (
            <span
              key={term}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
            >
              {term}
              <button
                onClick={() => removeIndustryTerm(term)}
                className="text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ICP Terms */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Target Audience (ICP Terms)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newIcpTerm}
            onChange={(e) => setNewIcpTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addIcpTerm()}
            placeholder="e.g., general counsel, compliance officer"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={addIcpTerm}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {icpTerms.map(term => (
            <span
              key={term}
              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
            >
              {term}
              <button
                onClick={() => removeIcpTerm(term)}
                className="text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Competitors */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Competitors
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCompetitor}
            onChange={(e) => setNewCompetitor(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addCompetitor()}
            placeholder="e.g., Epiq, Relativity"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={addCompetitor}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {competitors.map(competitor => (
            <span
              key={competitor}
              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
            >
              {competitor}
              <button
                onClick={() => removeCompetitor(competitor)}
                className="text-purple-600 hover:text-purple-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={handleCreate}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Create Profile
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
