/**
 * Weighted Template Selector Component
 */

import React, { useState } from 'react';
import { WeightedTemplate } from '../lib/types/weighted-templates';
import { TemplateCustomization } from './TemplateCustomization';

interface WeightedTemplateSelectorProps {
  templates: Record<string, WeightedTemplate>;
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
  onUpdateTemplate: (template: WeightedTemplate) => void;
}

export function WeightedTemplateSelector({ 
  templates, 
  selectedTemplate, 
  onSelectTemplate,
  onUpdateTemplate
}: WeightedTemplateSelectorProps) {
  const [showCustomization, setShowCustomization] = useState(false);

  const getOverallPrecision = (template: WeightedTemplate) => {
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'professional': return 'bg-blue-100 text-blue-800';
      case 'technical': return 'bg-green-100 text-green-800';
      case 'business': return 'bg-purple-100 text-purple-800';
      case 'academic': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-900">Select Industry Template</h3>
      
      {/* Template Categories */}
      <div className="space-y-4">
        {Object.entries(templates).map(([templateId, template]) => {
          const overallPrecision = getOverallPrecision(template);
          const precisionLevel = getPrecisionLevel(overallPrecision);
          
          return (
            <div
              key={templateId}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedTemplate === templateId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelectTemplate(templateId)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h4 className="font-medium text-slate-900">{template.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                      {template.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                  
                  {/* Precision Controls Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-slate-500">Precision:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${precisionLevel.bg} ${precisionLevel.color}`}>
                        {overallPrecision}/10 ({precisionLevel.level})
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-slate-500">Controls:</span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        {template.precision.crossIndustryPrevention.weight >= 7 ? 'Strong filtering' : 'Moderate filtering'}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {template.precision.geographicCoverage.weight >= 7 ? 'Focused geography' : 'Broad geography'}
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        {template.precision.qualityRequirements.weight >= 7 ? 'High quality' : 'Standard quality'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="ml-4">
                  <input
                    type="radio"
                    checked={selectedTemplate === templateId}
                    onChange={() => onSelectTemplate(templateId)}
                    className="h-4 w-4 text-blue-600"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Template Customization */}
      {selectedTemplate && templates[selectedTemplate] && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-slate-900">
              Customize {templates[selectedTemplate].name} Template
            </h4>
            <button
              onClick={() => setShowCustomization(!showCustomization)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {showCustomization ? 'Hide Customization' : 'Show Customization'}
            </button>
          </div>
          
          {showCustomization && (
            <TemplateCustomization
              template={templates[selectedTemplate]}
              onUpdateTemplate={onUpdateTemplate}
            />
          )}
        </div>
      )}

      {/* Template Selection Summary */}
      {selectedTemplate && templates[selectedTemplate] && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-slate-900 mb-2">Selected Template Summary</h4>
          <div className="text-sm text-slate-600 space-y-1">
            <div><strong>Template:</strong> {templates[selectedTemplate].name}</div>
            <div><strong>Category:</strong> {templates[selectedTemplate].category}</div>
            <div><strong>Overall Precision:</strong> {getOverallPrecision(templates[selectedTemplate])}/10</div>
            <div><strong>Industry Terms:</strong> {templates[selectedTemplate].industryTerms.length} terms</div>
            <div><strong>ICP Terms:</strong> {templates[selectedTemplate].icpTerms.length} terms</div>
            <div><strong>Negative Filters:</strong> {Object.values(templates[selectedTemplate].negativeFilters).flat().length} filters</div>
          </div>
        </div>
      )}
    </div>
  );
}
