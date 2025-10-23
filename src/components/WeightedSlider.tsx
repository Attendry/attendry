/**
 * Weighted Slider Component for Template Precision Controls
 */

import React from 'react';

interface WeightedSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  impact: string;
  min?: number;
  max?: number;
  step?: number;
}

export function WeightedSlider({ 
  label, 
  description, 
  value, 
  onChange, 
  impact, 
  min = 0, 
  max = 10, 
  step = 1 
}: WeightedSliderProps) {
  const getSliderColor = (value: number) => {
    if (value <= 3) return 'bg-red-500';
    if (value <= 6) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getWeightLabel = (value: number) => {
    if (value <= 2) return 'Very Low';
    if (value <= 4) return 'Low';
    if (value <= 6) return 'Medium';
    if (value <= 8) return 'High';
    return 'Very High';
  };

  const getWeightColor = (value: number) => {
    if (value <= 2) return 'text-red-600';
    if (value <= 4) return 'text-orange-600';
    if (value <= 6) return 'text-yellow-600';
    if (value <= 8) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-slate-900">{label}</h4>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-semibold ${getWeightColor(value)}`}>{value}</div>
          <div className="text-xs text-slate-500">{getWeightLabel(value)}</div>
        </div>
      </div>
      
      <div className="space-y-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${getSliderColor(value)}`}
          style={{
            background: `linear-gradient(to right, ${getSliderColor(value)} 0%, ${getSliderColor(value)} ${(value / max) * 100}%, #e5e7eb ${(value / max) * 100}%, #e5e7eb 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>0 (Disabled)</span>
          <span>5 (Balanced)</span>
          <span>10 (Maximum)</span>
        </div>
      </div>
      
      <div className="bg-blue-50 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>Impact:</strong> {impact}
        </p>
      </div>
    </div>
  );
}
