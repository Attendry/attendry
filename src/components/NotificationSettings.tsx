/**
 * Notification Settings Component
 * 
 * This component provides a focused interface for managing
 * notification preferences and settings.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';
// import { useUser } from '@supabase/auth-helpers-react';

/**
 * Notification settings interface
 */
interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  eventReminders: boolean;
  newEventAlerts: boolean;
  industryUpdates: boolean;
  marketingEmails: boolean;
  systemUpdates: boolean;
}

/**
 * Notification Settings Component
 */
const NotificationSettings = memo(function NotificationSettings() {
  // const { user } = useUser();
  const user = null; // Mock for now
  const [settings, setSettings] = useState<NotificationSettings>({
    email: true,
    inApp: true,
    frequency: 'daily',
    eventReminders: true,
    newEventAlerts: true,
    industryUpdates: true,
    marketingEmails: false,
    systemUpdates: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load notification settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      try {
        const response = await fetch('/api/profile/get');
        if (response.ok) {
          const data = await response.json();
          if (data.profile?.notificationSettings) {
            setSettings(data.profile.notificationSettings);
          }
        }
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Save notification settings
  const saveSettings = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationSettings: settings,
        }),
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [user, settings]);

  // Handle setting changes
  const handleSettingChange = useCallback((key: keyof NotificationSettings, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
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
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notification Settings</h1>
        <p className="text-gray-600">Manage how and when you receive notifications</p>
      </div>

      <div className="space-y-6">
        {/* General Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">General Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                <p className="text-sm text-gray-500">Receive notifications via email</p>
              </div>
              <input
                type="checkbox"
                checked={settings.email}
                onChange={(e) => handleSettingChange('email', e.target.checked)}
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
                checked={settings.inApp}
                onChange={(e) => handleSettingChange('inApp', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notification Frequency</label>
              <select
                value={settings.frequency}
                onChange={(e) => handleSettingChange('frequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="immediate">Immediate</option>
                <option value="daily">Daily Digest</option>
                <option value="weekly">Weekly Summary</option>
              </select>
            </div>
          </div>
        </div>

        {/* Event Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Event Reminders</label>
                <p className="text-sm text-gray-500">Get reminded about saved events</p>
              </div>
              <input
                type="checkbox"
                checked={settings.eventReminders}
                onChange={(e) => handleSettingChange('eventReminders', e.target.checked)}
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
                checked={settings.newEventAlerts}
                onChange={(e) => handleSettingChange('newEventAlerts', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Industry Updates</label>
                <p className="text-sm text-gray-500">Receive updates about your selected industries</p>
              </div>
              <input
                type="checkbox"
                checked={settings.industryUpdates}
                onChange={(e) => handleSettingChange('industryUpdates', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* System Notifications */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">System Updates</label>
                <p className="text-sm text-gray-500">Receive notifications about system updates and maintenance</p>
              </div>
              <input
                type="checkbox"
                checked={settings.systemUpdates}
                onChange={(e) => handleSettingChange('systemUpdates', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Marketing Emails</label>
                <p className="text-sm text-gray-500">Receive promotional emails and newsletters</p>
              </div>
              <input
                type="checkbox"
                checked={settings.marketingEmails}
                onChange={(e) => handleSettingChange('marketingEmails', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveSettings}
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
              <span>Save Settings</span>
            )}
          </button>
        </div>

        {/* Save Status */}
        {saveStatus === 'success' && (
          <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg">
            Notification settings saved successfully!
          </div>
        )}

        {saveStatus === 'error' && (
          <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg">
            Failed to save notification settings. Please try again.
          </div>
        )}
      </div>
    </div>
  );
});

export default NotificationSettings;
