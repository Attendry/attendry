/**
 * Event Prediction Component
 * 
 * This component provides event prediction using historical data
 * and trends to forecast future events.
 */

"use client";
import { useState, useEffect, useCallback, memo } from 'react';

/**
 * Prediction interface
 */
interface EventPrediction {
  id: string;
  title: string;
  predictedDate: string;
  confidence: number;
  location: string;
  industry: string;
  reasoning: string;
  historicalData: {
    similarEvents: number;
    averageFrequency: number;
    lastOccurrence: string;
  };
}

/**
 * Event Prediction Component
 */
const EventPrediction = memo(function EventPrediction() {
  const [predictions, setPredictions] = useState<EventPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  // Load predictions
  useEffect(() => {
    const loadPredictions = async () => {
      try {
        const response = await fetch('/api/events/predictions');
        if (response.ok) {
          const data = await response.json();
          setPredictions(data.predictions || []);
        }
      } catch (error) {
        console.error('Failed to load predictions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPredictions();
  }, []);

  // Filter predictions
  const filteredPredictions = useMemo(() => {
    return predictions.filter(prediction => {
      const industryMatch = selectedIndustry === 'all' || prediction.industry === selectedIndustry;
      const locationMatch = selectedLocation === 'all' || prediction.location === selectedLocation;
      return industryMatch && locationMatch;
    });
  }, [predictions, selectedIndustry, selectedLocation]);

  // Get unique industries and locations
  const industries = useMemo(() => {
    const unique = [...new Set(predictions.map(p => p.industry))];
    return unique.sort();
  }, [predictions]);

  const locations = useMemo(() => {
    const unique = [...new Set(predictions.map(p => p.location))];
    return unique.sort();
  }, [predictions]);

  // Format date
  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Get confidence color
  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
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
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Predictions</h1>
        <p className="text-gray-600">AI-powered predictions of future events based on historical data and trends</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Industries</option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Locations</option>
            {locations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Predictions */}
      <div className="space-y-6">
        {filteredPredictions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No predictions available</h3>
            <p className="text-gray-600">Check back later for event predictions</p>
          </div>
        ) : (
          filteredPredictions.map((prediction) => (
            <div key={prediction.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{prediction.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Predicted: {formatDate(prediction.predictedDate)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{prediction.location}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{prediction.industry}</span>
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(prediction.confidence)}`}>
                  {(prediction.confidence * 100).toFixed(0)}% confidence
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
                  <strong>Prediction reasoning:</strong> {prediction.reasoning}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Historical Data</h4>
                  <div className="space-y-1 text-sm text-blue-700">
                    <div>Similar events: {prediction.historicalData.similarEvents}</div>
                    <div>Avg frequency: {prediction.historicalData.averageFrequency} months</div>
                    <div>Last occurrence: {formatDate(prediction.historicalData.lastOccurrence)}</div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-900 mb-2">Prediction Factors</h4>
                  <div className="space-y-1 text-sm text-green-700">
                    <div>Historical patterns</div>
                    <div>Industry trends</div>
                    <div>Seasonal factors</div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-purple-900 mb-2">Actions</h4>
                  <div className="space-y-2">
                    <button className="w-full px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors">
                      Save Prediction
                    </button>
                    <button className="w-full px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors">
                      Set Reminder
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default EventPrediction;
