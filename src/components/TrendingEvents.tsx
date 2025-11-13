/**
 * Trending Events Component
 * 
 * This component displays trending events and popular event categories
 * based on user engagement and discovery patterns.
 */

"use client";
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { EventData } from '@/lib/types/core';

/**
 * Trending category interface
 */
interface TrendingCategory {
  name: string;
  count: number;
  growth: number;
  events: EventData[];
}

/**
 * Hot topic interface
 */
interface HotTopic {
  topic: string;
  mentionCount: number;
  growthRate: number;
  momentum: number;
  relatedEvents: string[];
  category: string;
  relevanceScore: number;
}

/**
 * Emerging theme interface
 */
interface EmergingTheme {
  theme: string;
  description: string;
  growth: number;
  events: EventData[];
  relevanceScore: number;
}

/**
 * Trending Events Component
 */
const TrendingEvents = memo(function TrendingEvents() {
  const [trendingCategories, setTrendingCategories] = useState<TrendingCategory[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<EventData[]>([]);
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([]);
  const [emergingThemes, setEmergingThemes] = useState<EmergingTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeWindow, setTimeWindow] = useState<'week' | 'month' | 'quarter'>('month');
  const [showHotTopics, setShowHotTopics] = useState(false);
  const [personalization, setPersonalization] = useState<{
    userIndustry: string[];
    filteredEventCount: number;
    totalEventCount: number;
  } | null>(null);

  // Load trending data
  useEffect(() => {
    const loadTrendingData = async () => {
      try {
        setIsLoading(true);
        const url = `/api/events/trending?includeHotTopics=${showHotTopics}&timeWindow=${timeWindow}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setTrendingCategories(data.categories || []);
          setTrendingEvents(data.events || []);
          setHotTopics(data.hotTopics || []);
          setEmergingThemes(data.emergingThemes || []);
          setPersonalization(data.personalization || null);
        }
      } catch (error) {
        console.error('Failed to load trending data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrendingData();
  }, [showHotTopics, timeWindow]);

  // Filter events by category
  const filteredEvents = useMemo(() => {
    if (selectedCategory === 'all') {
      return trendingEvents;
    }
    const category = trendingCategories.find(c => c.name === selectedCategory);
    return category ? category.events : [];
  }, [trendingEvents, trendingCategories, selectedCategory]);

  // Format growth percentage
  const formatGrowth = useCallback((growth: number) => {
    const sign = growth > 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  }, []);

  // Get growth color
  const getGrowthColor = useCallback((growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-slate-600';
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Trending Events</h1>
            <p className="text-slate-600">Discover what's popular and trending in the event space</p>
          </div>
          {personalization && personalization.userIndustry.length > 0 && (
            <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded">
              Personalized for your industry
            </div>
          )}
        </div>
        
        {/* Time Window & Hot Topics Toggle */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Time Window:</label>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as 'week' | 'month' | 'quarter')}
              className="text-sm border border-slate-300 rounded px-2 py-1"
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showHotTopics}
              onChange={(e) => setShowHotTopics(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded"
            />
            Show Hot Topics & Emerging Themes
          </label>
        </div>
      </div>

      {/* Hot Topics Section */}
      {showHotTopics && hotTopics.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            Hot Topics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotTopics.slice(0, 6).map((topic, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-orange-200">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-slate-900">{topic.topic}</h3>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                    {topic.momentum.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  {topic.mentionCount} events • {topic.category}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600">
                    +{topic.growthRate.toFixed(1)}% growth
                  </span>
                  <span className="text-xs text-slate-500">
                    Relevance: {(topic.relevanceScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emerging Themes Section */}
      {showHotTopics && emergingThemes.length > 0 && (
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            Emerging Themes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {emergingThemes.slice(0, 4).map((theme, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-blue-200">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-slate-900">{theme.theme}</h3>
                  <span className={`text-sm font-medium ${getGrowthColor(theme.growth)}`}>
                    {formatGrowth(theme.growth)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">{theme.description}</p>
                <p className="text-xs text-slate-500">
                  {theme.events.length} related events
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Categories */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Trending Categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trendingCategories.map((category) => (
            <div
              key={category.name}
              className={`bg-white border rounded-lg p-4 cursor-pointer transition-all ${
                selectedCategory === category.name
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedCategory(category.name)}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-slate-900">{category.name}</h3>
                <span className={`text-sm font-medium ${getGrowthColor(category.growth)}`}>
                  {formatGrowth(category.growth)}
                </span>
              </div>
              <p className="text-sm text-slate-600">{category.count} events</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Trending
          </button>
          {trendingCategories.map((category) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category.name
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Events */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          {selectedCategory === 'all' ? 'All Trending Events' : `Trending ${selectedCategory} Events`}
        </h2>
        
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No trending events</h3>
            <p className="text-slate-600">Check back later for trending events in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event, index) => (
              <div key={event.id || index} className="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 line-clamp-2">{event.title}</h3>
                  <div className="flex items-center space-x-1 text-sm text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Trending</span>
                  </div>
                </div>

                {event.starts_at && (
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-slate-600">
                      {new Date(event.starts_at).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {(event.city || event.country) && (
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm text-slate-600">
                      {[event.city, event.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}

                {event.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-3">{event.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <a
                    href={event.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View Event
                  </a>
                  <button className="text-sm text-slate-600 hover:text-slate-800 transition-colors">
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default TrendingEvents;
