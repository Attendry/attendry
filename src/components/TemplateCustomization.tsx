/**
 * Template Customization Component with Weighted Controls
 */

import React, { useState } from 'react';
import { WeightedTemplate } from '../lib/types/weighted-templates';
import { WeightedSlider } from './WeightedSlider';
import { GeographicAutoSuggestion } from './GeographicAutoSuggestion';

interface TemplateCustomizationProps {
  template: WeightedTemplate;
  onUpdateTemplate: (template: WeightedTemplate) => void;
}

export function TemplateCustomization({ 
  template, 
  onUpdateTemplate 
}: TemplateCustomizationProps) {
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const updatePrecisionWeight = (key: keyof typeof template.precision, weight: number) => {
    onUpdateTemplate({
      ...template,
      precision: {
        ...template.precision,
        [key]: {
          ...template.precision[key],
          weight
        }
      }
    });
  };

  const updateGeographicCoverage = (cities: string[], regions: string[]) => {
    // Update template with selected cities and regions
    const updatedTemplate = {
      ...template,
      geographicCoverage: {
        ...template.geographicCoverage,
        cities: cities.map(city => ({
          city,
          weight: 8, // Default weight for user-selected cities
          country: selectedCountry
        })),
        regions: regions.map(region => ({
          region,
          weight: 7, // Default weight for user-selected regions
          country: selectedCountry
        }))
      }
    };
    
    onUpdateTemplate(updatedTemplate);
  };

  const handleCitiesChange = (cities: string[]) => {
    setSelectedCities(cities);
    updateGeographicCoverage(cities, selectedRegions);
  };

  const handleRegionsChange = (regions: string[]) => {
    setSelectedRegions(regions);
    updateGeographicCoverage(selectedCities, regions);
  };

  const getOverallPrecision = () => {
    const weights = [
      template.precision.industrySpecificQuery.weight,
      template.precision.crossIndustryPrevention.weight,
      template.precision.geographicCoverage.weight,
      template.precision.qualityRequirements.weight,
      template.precision.eventTypeSpecificity.weight
    ];
    
    const average = weights.reduce((sum, weight) => sum + weight, 0) / weights.length;
    return Math.round(average * 10) / 10;
  };

  const getPrecisionLevel = (average: number) => {
    if (average <= 3) return { level: 'Low', color: 'text-red-600', bg: 'bg-red-50' };
    if (average <= 6) return { level: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (average <= 8) return { level: 'High', color: 'text-blue-600', bg: 'bg-blue-50' };
    return { level: 'Very High', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const overallPrecision = getOverallPrecision();
  const precisionLevel = getPrecisionLevel(overallPrecision);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Customize Template Precision</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${precisionLevel.bg} ${precisionLevel.color}`}>
          Overall Precision: {overallPrecision}/10 ({precisionLevel.level})
        </div>
      </div>
      
      {/* Precision Control Sliders */}
      <div className="space-y-4">
        <WeightedSlider
          label="Industry-Specific Query Construction"
          description="How strictly to enforce industry-specific terms in search queries"
          value={template.precision.industrySpecificQuery.weight}
          onChange={(weight) => updatePrecisionWeight('industrySpecificQuery', weight)}
          impact="Higher values will use more industry-specific terms, lower values will use more generic terms"
        />

        <WeightedSlider
          label="Cross-Industry Contamination Prevention"
          description="How strictly to prevent finding events from other industries"
          value={template.precision.crossIndustryPrevention.weight}
          onChange={(weight) => updatePrecisionWeight('crossIndustryPrevention', weight)}
          impact="Higher values will exclude more non-industry events, lower values will be more permissive"
        />

        <WeightedSlider
          label="Geographic Coverage"
          description="How strictly to enforce geographic coverage requirements"
          value={template.precision.geographicCoverage.weight}
          onChange={(weight) => updatePrecisionWeight('geographicCoverage', weight)}
          impact="Higher values will require more cities/regions, lower values will have broader geographic scope"
        />

        <WeightedSlider
          label="Quality Requirements"
          description="How strictly to enforce quality requirements for events"
          value={template.precision.qualityRequirements.weight}
          onChange={(weight) => updatePrecisionWeight('qualityRequirements', weight)}
          impact="Higher values will require more complete event data, lower values will be more lenient"
        />

        <WeightedSlider
          label="Event Type Specificity"
          description="How specific to be with event types"
          value={template.precision.eventTypeSpecificity.weight}
          onChange={(weight) => updatePrecisionWeight('eventTypeSpecificity', weight)}
          impact="Higher values will use industry-specific event types, lower values will use generic event types"
        />
      </div>

      {/* Geographic Auto-Suggestions */}
      <GeographicAutoSuggestion
        country={selectedCountry}
        industry={template.id}
        selectedCities={selectedCities}
        selectedRegions={selectedRegions}
        onCitiesChange={handleCitiesChange}
        onRegionsChange={handleRegionsChange}
      />

      {/* Template Preview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-slate-900 mb-3">Template Preview</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium text-slate-700 mb-2">Precision Controls</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Industry-Specific Query:</span>
                <span className="font-medium">{template.precision.industrySpecificQuery.weight}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Cross-Industry Prevention:</span>
                <span className="font-medium">{template.precision.crossIndustryPrevention.weight}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Geographic Coverage:</span>
                <span className="font-medium">{template.precision.geographicCoverage.weight}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Quality Requirements:</span>
                <span className="font-medium">{template.precision.qualityRequirements.weight}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Event Type Specificity:</span>
                <span className="font-medium">{template.precision.eventTypeSpecificity.weight}/10</span>
              </div>
            </div>
          </div>
          <div>
            <div className="font-medium text-slate-700 mb-2">Geographic Coverage</div>
            <div className="space-y-1">
              <div>
                <span className="font-medium">Cities:</span> {selectedCities.length} selected
              </div>
              <div>
                <span className="font-medium">Regions:</span> {selectedRegions.length} selected
              </div>
              <div>
                <span className="font-medium">Country:</span> {selectedCountry}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Expected Impact</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div>
            <strong>Search Precision:</strong> {overallPrecision >= 7 ? 'High' : overallPrecision >= 4 ? 'Medium' : 'Low'} - 
            {overallPrecision >= 7 ? ' Very specific results with strong industry focus' : 
             overallPrecision >= 4 ? ' Balanced results with moderate industry focus' : 
             ' Broad results with minimal industry filtering'}
          </div>
          <div>
            <strong>Cross-Industry Contamination:</strong> {template.precision.crossIndustryPrevention.weight >= 7 ? 'Low' : template.precision.crossIndustryPrevention.weight >= 4 ? 'Medium' : 'High'} - 
            {template.precision.crossIndustryPrevention.weight >= 7 ? ' Strong filtering prevents irrelevant events' : 
             template.precision.crossIndustryPrevention.weight >= 4 ? ' Moderate filtering reduces irrelevant events' : 
             ' Minimal filtering may include irrelevant events'}
          </div>
          <div>
            <strong>Geographic Coverage:</strong> {template.precision.geographicCoverage.weight >= 7 ? 'Focused' : template.precision.geographicCoverage.weight >= 4 ? 'Balanced' : 'Broad'} - 
            {template.precision.geographicCoverage.weight >= 7 ? ' Specific cities and regions targeted' : 
             template.precision.geographicCoverage.weight >= 4 ? ' Country-level coverage with some city focus' : 
             ' Broad geographic coverage with minimal restrictions'}
          </div>
        </div>
      </div>
    </div>
  );
}
