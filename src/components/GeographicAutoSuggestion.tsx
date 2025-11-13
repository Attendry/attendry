/**
 * Geographic Auto-Suggestion Component for Template Customization
 */

import React, { useState, useEffect } from 'react';
import { GeographicAutoSuggestion as GeographicSuggestion } from '../lib/types/weighted-templates';
import { getGeographicSuggestions } from '../lib/data/geographic-suggestions';

interface GeographicAutoSuggestionProps {
  country: string;
  industry: string;
  selectedCities: string[];
  selectedRegions: string[];
  onCitiesChange: (cities: string[]) => void;
  onRegionsChange: (regions: string[]) => void;
}

export function GeographicAutoSuggestion({
  country,
  industry,
  selectedCities,
  selectedRegions,
  onCitiesChange,
  onRegionsChange
}: GeographicAutoSuggestionProps) {
  const [suggestions, setSuggestions] = useState<GeographicSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    // Load suggestions based on country and industry
    const loadSuggestions = async () => {
      const industryData = getGeographicSuggestions(industry, country);
      if (industryData) {
        setSuggestions(industryData);
      }
    };
    
    loadSuggestions();
  }, [country, industry]);

  const handleCityToggle = (cityName: string) => {
    if (selectedCities.includes(cityName)) {
      onCitiesChange(selectedCities.filter(c => c !== cityName));
    } else {
      onCitiesChange([...selectedCities, cityName]);
    }
  };

  const handleRegionToggle = (regionName: string) => {
    if (selectedRegions.includes(regionName)) {
      onRegionsChange(selectedRegions.filter(r => r !== regionName));
    } else {
      onRegionsChange([...selectedRegions, regionName]);
    }
  };

  const handleSelectAllCities = () => {
    if (suggestions) {
      const allCities = suggestions.cities.map(city => city.name);
      onCitiesChange(allCities);
    }
  };

  const handleSelectAllRegions = () => {
    if (suggestions) {
      const allRegions = suggestions.regions.map(region => region.name);
      onRegionsChange(allRegions);
    }
  };

  const handleClearAll = () => {
    onCitiesChange([]);
    onRegionsChange([]);
  };

  if (!suggestions) {
    return (
      <div className="bg-white border rounded-lg p-4">
        <h4 className="font-medium text-slate-900 mb-2">Geographic Coverage</h4>
        <p className="text-sm text-slate-600">
          No geographic suggestions available for {industry} in {country}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-slate-900">Geographic Coverage</h4>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showSuggestions ? 'Hide Suggestions' : 'Show Auto-Suggestions'}
          </button>
        </div>
      </div>

      {showSuggestions && (
        <div className="space-y-4">
          {/* Cities Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-slate-700">Suggested Cities</h5>
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectAllCities}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  onClick={() => onCitiesChange([])}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.cities.map((city) => (
                <label
                  key={city.name}
                  className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedCities.includes(city.name)
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCities.includes(city.name)}
                    onChange={() => handleCityToggle(city.name)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{city.name}</div>
                    <div className="text-xs text-slate-500">
                      Weight: {city.weight}/10 • Pop: {city.population.toLocaleString()}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Regions Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium text-slate-700">Suggested Regions</h5>
              <div className="flex space-x-2">
                <button
                  onClick={handleSelectAllRegions}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <button
                  onClick={() => onRegionsChange([])}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {suggestions.regions.map((region) => (
                <label
                  key={region.name}
                  className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedRegions.includes(region.name)
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRegions.includes(region.name)}
                    onChange={() => handleRegionToggle(region.name)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{region.name}</div>
                    <div className="text-xs text-slate-500">
                      Weight: {region.weight}/10 • Cities: {region.cities.length}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex space-x-2">
            <button
              onClick={handleSelectAllCities}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Select All Cities
            </button>
            <button
              onClick={handleSelectAllRegions}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
            >
              Select All Regions
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Selected Items Summary */}
      <div className="bg-slate-50 rounded-lg p-3">
        <h5 className="font-medium text-slate-700 mb-2">Selected Coverage</h5>
        <div className="space-y-1">
          <div className="text-sm">
            <strong>Cities:</strong> {selectedCities.length > 0 ? selectedCities.join(', ') : 'None selected'}
          </div>
          <div className="text-sm">
            <strong>Regions:</strong> {selectedRegions.length > 0 ? selectedRegions.join(', ') : 'None selected'}
          </div>
        </div>
      </div>
    </div>
  );
}
