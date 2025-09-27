/**
 * User Profile Component
 * 
 * This component provides enhanced user profile management with
 * detailed preferences, industry customization, and notification settings.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
import { useUser } from '@supabase/auth-helpers-react';

/**
 * User preferences interface
 */
interface UserPreferences {
  industries: string[];
  locations: string[];
  eventTypes: string[];
  notificationSettings: {
    email: boolean;
    inApp: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    eventReminders: boolean;
    newEventAlerts: boolean;
    industryUpdates: boolean;
  };
  searchPreferences: {
    defaultDateRange: number;
    preferredCountries: string[];
    autoSaveSearches: boolean;
    showAdvancedFilters: boolean;
  };
  privacySettings: {
    profileVisibility: 'public' | 'private';
    showActivity: boolean;
    allowRecommendations: boolean;
  };
}

/**
 * Industry options
 */
const INDUSTRIES = [
  'Legal & Compliance',
  'FinTech',
  'Healthcare',
  'Technology',
  'Finance',
  'Insurance',
  'Banking',
  'Regulatory',
  'Risk Management',
  'Data Protection',
  'Cybersecurity',
  'ESG',
  'Governance',
  'Audit',
  'Consulting',
];

/**
 * Event types
 */
const EVENT_TYPES = [
  'Conference',
  'Summit',
  'Workshop',
  'Seminar',
  'Webinar',
  'Training',
  'Certification',
  'Networking',
  'Exhibition',
  'Forum',
  'Symposium',
  'Masterclass',
  'Bootcamp',
];

/**
 * User Profile Component
 */
const UserProfile = memo(function UserProfile() {
  const { user } = useUser();
  const [preferences, setPreferences] = useState<UserPreferences>({
    industries: [],
    locations: [],
    eventTypes: [],
    notificationSettings: {
      email: true,
      inApp: true,
      frequency: 'daily',
      eventReminders: true,
      newEventAlerts: true,
      industryUpdates: true,
    },
    searchPreferences: {
      defaultDateRange: 7,
      preferredCountries: [],
      autoSaveSearches: true,
      showAdvancedFilters: false,
    },
    privacySettings: {
      profileVisibility: 'private',
      showActivity: false,
      allowRecommendations: true,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/profile/get');
        if (response.ok) {
          const data = await response.json();
          if (data.profile?.preferences) {
            setPreferences(data.profile.preferences);
          }
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Save preferences
  const savePreferences = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
        }),
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [user, preferences]);

  // Handle preference changes
  const handlePreferenceChange = useCallback((section: keyof UserPreferences, key: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  }, []);

  // Handle array preference changes
  const handleArrayPreferenceChange = useCallback((section: keyof UserPreferences, key: string, value: string, checked: boolean) => {
    setPreferences(prev => {
      const currentArray = (prev[section] as any)[key] || [];
      const newArray = checked
        ? [...currentArray, value]
        : currentArray.filter((item: string) => item !== value);
      
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: newArray,
        },
      };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">User Profile</h1>
        <p className="text-gray-600">Customize your experience and preferences</p>
      </div>

      <div className="space-y-8">
        {/* Industry Preferences */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Industry Interests</h2>
          <p className="text-gray-600 mb-4">Select the industries you're most interested in to receive relevant event recommendations.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {INDUSTRIES.map((industry) => (
              <label key={industry} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.industries.includes(industry)}
                  onChange={(e) => handleArrayPreferenceChange('industries', 'industries', industry, e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{industry}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Event Type Preferences */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Preferred Event Types</h2>
          <p className="text-gray-600 mb-4">Choose the types of events you're most interested in attending.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {EVENT_TYPES.map((eventType) => (
              <label key={eventType} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.eventTypes.includes(eventType)}
                  onChange={(e) => handleArrayPreferenceChange('eventTypes', 'eventTypes', eventType, e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{eventType}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Preferences</h2>
          <p className="text-gray-600 mb-4">Configure how and when you want to receive notifications.</p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                <p className="text-sm text-gray-500">Receive notifications via email</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notificationSettings.email}
                onChange={(e) => handlePreferenceChange('notificationSettings', 'email', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">In-App Notifications</label>
                <p className="text-sm text-gray-500">Receive notifications within the application</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notificationSettings.inApp}
                onChange={(e) => handlePreferenceChange('notificationSettings', 'inApp', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Event Reminders</label>
                <p className="text-sm text-gray-500">Get reminded about saved events</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notificationSettings.eventReminders}
                onChange={(e) => handlePreferenceChange('notificationSettings', 'eventReminders', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">New Event Alerts</label>
                <p className="text-sm text-gray-500">Get notified about new events matching your interests</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.notificationSettings.newEventAlerts}
                onChange={(e) => handlePreferenceChange('notificationSettings', 'newEventAlerts', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notification Frequency</label>
              <select
                value={preferences.notificationSettings.frequency}
                onChange={(e) => handlePreferenceChange('notificationSettings', 'frequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="immediate">Immediate</option>
                <option value="daily">Daily Digest</option>
                <option value="weekly">Weekly Summary</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search Preferences */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Preferences</h2>
          <p className="text-gray-600 mb-4">Customize your default search behavior.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Date Range (days)</label>
              <select
                value={preferences.searchPreferences.defaultDateRange}
                onChange={(e) => handlePreferenceChange('searchPreferences', 'defaultDateRange', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto-save Searches</label>
                <p className="text-sm text-gray-500">Automatically save your search history</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.searchPreferences.autoSaveSearches}
                onChange={(e) => handlePreferenceChange('searchPreferences', 'autoSaveSearches', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Show Advanced Filters by Default</label>
                <p className="text-sm text-gray-500">Display advanced search options immediately</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.searchPreferences.showAdvancedFilters}
                onChange={(e) => handlePreferenceChange('searchPreferences', 'showAdvancedFilters', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy Settings</h2>
          <p className="text-gray-600 mb-4">Control your privacy and data sharing preferences.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Visibility</label>
              <select
                value={preferences.privacySettings.profileVisibility}
                onChange={(e) => handlePreferenceChange('privacySettings', 'profileVisibility', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Show Activity</label>
                <p className="text-sm text-gray-500">Allow others to see your event activity</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.privacySettings.showActivity}
                onChange={(e) => handlePreferenceChange('privacySettings', 'showActivity', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Allow Recommendations</label>
                <p className="text-sm text-gray-500">Use your data to provide personalized recommendations</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.privacySettings.allowRecommendations}
                onChange={(e) => handlePreferenceChange('privacySettings', 'allowRecommendations', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={savePreferences}
            disabled={isSaving}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center space-x-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </div>

        {/* Save Status */}
        {saveStatus === 'success' && (
          <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg">
            Preferences saved successfully!
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg">
            Failed to save preferences. Please try again.
          </div>
        )}
      </div>
    </div>
  );
});

export default UserProfile;
