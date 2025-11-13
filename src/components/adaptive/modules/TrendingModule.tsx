'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Flame, 
  MapPin, 
  Calendar, 
  Users,
  Star,
  ExternalLink,
  Bookmark,
  BarChart3,
  Clock
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';

interface TrendingEvent {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  city: string;
  country: string;
  organizer: string;
  source_url: string;
  tags: string[];
  trendScore: number;
  attendees: number;
  price?: string;
  growthRate: number;
  category: string;
}

interface TrendingCategory {
  name: string;
  count: number;
  growth: number;
  events: TrendingEvent[];
}

const mockTrendingData: TrendingCategory[] = [
  {
    name: 'AI & Legal Tech',
    count: 15,
    growth: 45,
    events: [
      {
        id: '1',
        title: 'AI in Legal Practice Summit 2024',
        description: 'Explore how artificial intelligence is transforming legal practice and client services',
        starts_at: '2024-03-15T09:00:00Z',
        city: 'Berlin',
        country: 'Germany',
        organizer: 'Legal AI Institute',
        source_url: '#',
        tags: ['ai', 'legal-tech', 'automation'],
        trendScore: 95,
        attendees: 800,
        price: '€399',
        growthRate: 45,
        category: 'AI & Legal Tech'
      },
      {
        id: '2',
        title: 'Legal Automation Workshop',
        description: 'Hands-on workshop on implementing automation in legal workflows',
        starts_at: '2024-03-22T10:00:00Z',
        city: 'Munich',
        country: 'Germany',
        organizer: 'Legal Tech Hub',
        source_url: '#',
        tags: ['automation', 'workflow', 'efficiency'],
        trendScore: 88,
        attendees: 200,
        price: '€199',
        growthRate: 38,
        category: 'AI & Legal Tech'
      }
    ]
  },
  {
    name: 'Compliance & Risk',
    count: 12,
    growth: 32,
    events: [
      {
        id: '3',
        title: 'GDPR Compliance Masterclass',
        description: 'Comprehensive guide to GDPR compliance and data protection best practices',
        starts_at: '2024-03-08T09:00:00Z',
        city: 'Frankfurt',
        country: 'Germany',
        organizer: 'Privacy Institute',
        source_url: '#',
        tags: ['gdpr', 'compliance', 'data-protection'],
        trendScore: 92,
        attendees: 500,
        price: '€299',
        growthRate: 32,
        category: 'Compliance & Risk'
      }
    ]
  },
  {
    name: 'FinTech Legal',
    count: 8,
    growth: 28,
    events: [
      {
        id: '4',
        title: 'Digital Banking Legal Forum',
        description: 'Legal challenges and opportunities in digital banking and fintech',
        starts_at: '2024-03-12T09:00:00Z',
        city: 'Hamburg',
        country: 'Germany',
        organizer: 'FinTech Legal Network',
        source_url: '#',
        tags: ['fintech', 'banking', 'digital-transformation'],
        trendScore: 85,
        attendees: 300,
        price: '€249',
        growthRate: 28,
        category: 'FinTech Legal'
      }
    ]
  }
];

export const TrendingModule = () => {
  const { theme, updateUserBehavior, userBehavior } = useAdaptive();
  const [trendingData, setTrendingData] = useState<TrendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week');

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setTrendingData(mockTrendingData);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeRange]);

  const handleEventClick = (event: TrendingEvent) => {
    updateUserBehavior({ 
      eventClicks: userBehavior.eventClicks + 1,
      preferredIndustries: [...new Set([...userBehavior.preferredIndustries, event.category])]
    });
  };

  const handleSaveEvent = (event: TrendingEvent) => {
    updateUserBehavior({ savedEvents: userBehavior.savedEvents + 1 });
  };

  const getTrendColor = (growth: number) => {
    if (growth >= 40) return 'text-red-500';
    if (growth >= 25) return 'text-orange-500';
    if (growth >= 15) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getTrendIcon = (growth: number) => {
    if (growth >= 30) return Flame;
    return TrendingUp;
  };

  const filteredData = selectedCategory === 'all' 
    ? trendingData 
    : trendingData.filter(cat => cat.name === selectedCategory);

  const categories = [
    { id: 'all', label: 'All Categories' },
    ...trendingData.map(cat => ({ id: cat.name, label: cat.name }))
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Trending Events
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Discover what's popular and gaining momentum in your industry
            </p>
          </div>
        </div>

        {/* AI Suggestion */}
        <SuggestionBanner
          suggestion="AI & Legal Tech events are trending up 45% this week! These might be perfect for your interests."
          onAccept={() => {
            setSelectedCategory('AI & Legal Tech');
          }}
        />
      </div>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        {/* Time Range Selector */}
        <div className="flex items-center space-x-2">
          <Clock size={16} className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} />
          <div className="flex space-x-2">
            {(['week', 'month', 'quarter'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeRange === range
                    ? theme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : theme === 'high-contrast'
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-100 text-blue-700'
                    : theme === 'dark'
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : theme === 'high-contrast'
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'This Quarter'}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex space-x-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                selectedCategory === category.id
                  ? theme === 'dark'
                    ? 'bg-blue-600 text-white'
                    : theme === 'high-contrast'
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-100 text-blue-700'
                  : theme === 'dark'
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : theme === 'high-contrast'
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Analyzing trending events...
            </p>
          </div>
        </div>
      )}

      {/* Trending Data */}
      {!loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {filteredData.map((category, index) => (
              <motion.div
                key={category.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-6 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700'
                    : theme === 'high-contrast'
                    ? 'bg-slate-900 border-slate-600'
                    : 'bg-white border-slate-200'
                }`}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'
                    }`}>
                      <BarChart3 className={`w-5 h-5 ${getTrendColor(category.growth)}`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {category.name}
                      </h3>
                      <p className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {category.count} events trending
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className={`flex items-center space-x-1 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {(() => {
                        const TrendIcon = getTrendIcon(category.growth);
                        return <TrendIcon size={16} className={getTrendColor(category.growth)} />;
                      })()}
                      <span className={`text-sm font-medium ${getTrendColor(category.growth)}`}>
                        +{category.growth}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Events List */}
                <div className="space-y-3">
                  {category.events.map((event, eventIndex) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: eventIndex * 0.1 }}
                      onClick={() => handleEventClick(event)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                          : theme === 'high-contrast'
                          ? 'bg-slate-800/50 border-slate-500 hover:bg-slate-800'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className={`font-medium ${
                              theme === 'dark' ? 'text-white' : 'text-slate-900'
                            }`}>
                              {event.title}
                            </h4>
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                              theme === 'dark'
                                ? 'bg-orange-900/20 text-orange-400'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              <Flame size={12} />
                              <span>{event.trendScore}</span>
                            </div>
                          </div>
                          
                          <p className={`text-sm mb-3 line-clamp-2 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {event.description}
                          </p>
                          
                          <div className="flex items-center space-x-4 text-sm">
                            <div className={`flex items-center space-x-1 ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              <Calendar size={14} />
                              <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                            </div>
                            
                            <div className={`flex items-center space-x-1 ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              <MapPin size={14} />
                              <span>{event.city}, {event.country}</span>
                            </div>
                            
                            <div className={`flex items-center space-x-1 ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              <Users size={14} />
                              <span>{event.attendees} attendees</span>
                            </div>
                            
                            {event.price && (
                              <div className={`flex items-center space-x-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                              }`}>
                                <span className="font-medium">{event.price}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Tags */}
                          <div className="flex flex-wrap gap-1 mt-3">
                            {event.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className={`px-2 py-1 text-xs rounded-full ${
                                  theme === 'dark'
                                    ? 'bg-slate-600 text-slate-300'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEvent(event);
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-slate-600 text-slate-400'
                                : 'hover:bg-slate-200 text-slate-500'
                            }`}
                          >
                            <Bookmark size={16} />
                          </button>
                          
                          <a
                            href={event.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : theme === 'high-contrast'
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <ExternalLink size={14} className="inline mr-1" />
                            View
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredData.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'
            }`}>
              <TrendingUp 
                size={32} 
                className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} 
              />
            </div>
            <h3 className={`text-lg font-medium mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              No trending events found
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Check back later for trending events in your industry.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
