/**
 * Accessibility Enhancements Component
 * 
 * This component provides accessibility features and enhancements
 * to improve the user experience for all users.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';

/**
 * Accessibility settings interface
 */
interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  keyboardNavigation: boolean;
  screenReader: boolean;
  focusIndicators: boolean;
}

/**
 * Accessibility Enhancements Component
 */
const AccessibilityEnhancements = memo(function AccessibilityEnhancements() {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    keyboardNavigation: false,
    screenReader: false,
    focusIndicators: true,
  });

  // Load accessibility settings
  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('accessibilitySettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    };

    loadSettings();
  }, []);

  // Apply accessibility settings
  useEffect(() => {
    applyAccessibilitySettings(settings);
  }, [settings]);

  // Apply accessibility settings to the document
  const applyAccessibilitySettings = useCallback((settings: AccessibilitySettings) => {
    const root = document.documentElement;

    // High contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Large text
    if (settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Keyboard navigation
    if (settings.keyboardNavigation) {
      root.classList.add('keyboard-navigation');
    } else {
      root.classList.remove('keyboard-navigation');
    }

    // Screen reader
    if (settings.screenReader) {
      root.classList.add('screen-reader');
    } else {
      root.classList.remove('screen-reader');
    }

    // Focus indicators
    if (settings.focusIndicators) {
      root.classList.add('focus-indicators');
    } else {
      root.classList.remove('focus-indicators');
    }
  }, []);

  // Handle setting change
  const handleSettingChange = useCallback((key: keyof AccessibilitySettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('accessibilitySettings', JSON.stringify(newSettings));
  }, [settings]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaultSettings: AccessibilitySettings = {
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      keyboardNavigation: false,
      screenReader: false,
      focusIndicators: true,
    };
    setSettings(defaultSettings);
    localStorage.setItem('accessibilitySettings', JSON.stringify(defaultSettings));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Accessibility Settings</h1>
        <p className="text-slate-600">Customize your experience to make the application more accessible</p>
      </div>

      <div className="space-y-6">
        {/* Visual Enhancements */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Visual Enhancements</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">High Contrast Mode</label>
                <p className="text-sm text-slate-500">Increase contrast for better visibility</p>
              </div>
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(e) => handleSettingChange('highContrast', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">Large Text</label>
                <p className="text-sm text-slate-500">Increase text size for better readability</p>
              </div>
              <input
                type="checkbox"
                checked={settings.largeText}
                onChange={(e) => handleSettingChange('largeText', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">Focus Indicators</label>
                <p className="text-sm text-slate-500">Show clear focus indicators for keyboard navigation</p>
              </div>
              <input
                type="checkbox"
                checked={settings.focusIndicators}
                onChange={(e) => handleSettingChange('focusIndicators', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Motion and Animation */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Motion and Animation</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">Reduce Motion</label>
                <p className="text-sm text-slate-500">Minimize animations and transitions</p>
              </div>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => handleSettingChange('reducedMotion', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Navigation</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">Enhanced Keyboard Navigation</label>
                <p className="text-sm text-slate-500">Improve keyboard navigation experience</p>
              </div>
              <input
                type="checkbox"
                checked={settings.keyboardNavigation}
                onChange={(e) => handleSettingChange('keyboardNavigation', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Screen Reader */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Screen Reader</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">Screen Reader Optimizations</label>
                <p className="text-sm text-slate-500">Optimize content for screen readers</p>
              </div>
              <input
                type="checkbox"
                checked={settings.screenReader}
                onChange={(e) => handleSettingChange('screenReader', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
});

export default AccessibilityEnhancements;
