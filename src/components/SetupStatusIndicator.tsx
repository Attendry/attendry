"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SetupStatus = {
  profile: boolean;
  searchConfig: boolean;
  overall: 'red' | 'yellow' | 'green';
};

type SetupStatusIndicatorProps = {
  className?: string;
};

export function SetupStatusIndicator({ className = "" }: SetupStatusIndicatorProps) {
  const [status, setStatus] = useState<SetupStatus>({
    profile: false,
    searchConfig: false,
    overall: 'red'
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkSetupStatus();
  }, []);

  async function checkSetupStatus() {
    try {
      setLoading(true);
      
      // Check profile status
      const profileResponse = await fetch('/api/profile/get');
      const profileData = await profileResponse.json();
      const hasProfile = profileData.profile && 
        profileData.profile.full_name && 
        profileData.profile.company &&
        profileData.profile.full_name.trim() !== '' &&
        profileData.profile.company.trim() !== '';

      // Check search config status
      const configResponse = await fetch('/api/config/search');
      const configData = await configResponse.json();
      const hasSearchConfig = configData.config && 
        configData.config.name && 
        configData.config.industry &&
        configData.config.baseQuery &&
        configData.config.name.trim() !== '' &&
        configData.config.industry.trim() !== '' &&
        configData.config.baseQuery.trim() !== '';

      // Determine overall status
      let overall: 'red' | 'yellow' | 'green' = 'red';
      if (hasProfile && hasSearchConfig) {
        overall = 'green';
      } else if (hasProfile || hasSearchConfig) {
        overall = 'yellow';
      }

      setStatus({
        profile: hasProfile,
        searchConfig: hasSearchConfig,
        overall
      });
    } catch (error) {
      console.error('Failed to check setup status:', error);
      setStatus({
        profile: false,
        searchConfig: false,
        overall: 'red'
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-500">Checking setup...</span>
      </div>
    );
  }

  const getStatusColor = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
    }
  };

  const getStatusText = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'green': return 'Ready to search';
      case 'yellow': return 'Setup incomplete';
      case 'red': return 'Setup required';
    }
  };

  const getStatusMessage = () => {
    if (status.overall === 'green') {
      return 'Your profile and search configuration are complete. You\'re ready for personalized searches!';
    } else if (status.overall === 'yellow') {
      const missing = [];
      if (!status.profile) missing.push('profile');
      if (!status.searchConfig) missing.push('search configuration');
      return `Complete your ${missing.join(' and ')} for better search results.`;
    } else {
      return 'Set up your profile and search configuration to get personalized event recommendations.';
    }
  };

  return (
    <div className={`bg-white border rounded-lg p-4 ${
      status.overall === 'red' 
        ? 'border-red-200 bg-red-50' 
        : status.overall === 'yellow' 
        ? 'border-yellow-200 bg-yellow-50' 
        : 'border-green-200 bg-green-50'
    } ${className}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(status.overall)}`}></div>
        <span className={`text-sm font-medium ${
          status.overall === 'red' 
            ? 'text-red-700' 
            : status.overall === 'yellow' 
            ? 'text-yellow-700' 
            : 'text-green-700'
        }`}>
          {getStatusText(status.overall)}
        </span>
      </div>
      
      <p className={`text-xs mb-3 ${
        status.overall === 'red' 
          ? 'text-red-600' 
          : status.overall === 'yellow' 
          ? 'text-yellow-600' 
          : 'text-green-600'
      }`}>
        {getStatusMessage()}
      </p>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${status.profile ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-600">Profile</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${status.searchConfig ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-600">Search Config</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {!status.profile && (
              <Link 
                href="/admin?tab=profile"
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Setup Profile
              </Link>
            )}
            {!status.searchConfig && (
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Setup Search
              </button>
            )}
          </div>
          <button
            onClick={checkSetupStatus}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors"
            title="Refresh setup status"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
