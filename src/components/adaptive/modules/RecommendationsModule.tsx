'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  Heart, 
  Star, 
  MapPin, 
  Calendar, 
  Users,
  TrendingUp,
  Clock,
  ExternalLink,
  Bookmark
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: 'similar' | 'industry' | 'trending' | 'location' | 'time' | 'collaborative';
  events: Event[];
  confidence: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at?: string;
  city: string;
  country: string;
  organizer: string;
  source_url: string;
  tags: string[];
  attendees?: number;
  price?: string;
}

const mockRecommendations: Recommendation[] = [
  {
    id: '1',
    title: 'Similar to Your Saved Events',
    description: 'Events similar to the ones you\'ve saved and shown interest in',
    category: 'similar',
    confidence: 0.85,
    events: [
      {
        id: '1',
        title: 'Legal Tech Innovation Summit 2024',
        description: 'Explore the latest innovations in legal technology and digital transformation',
        starts_at: '2024-02-15T09:00:00Z',
        city: 'Berlin',
        country: 'Germany',
        organizer: 'Legal Tech Association',
        source_url: '#',
        tags: ['legal-tech', 'innovation', 'digital-transformation'],
        attendees: 500,
        price: '€299'
      },
      {
        id: '2',
        title: 'Compliance & Risk Management Conference',
        description: 'Comprehensive coverage of compliance frameworks and risk management strategies',
        starts_at: '2024-02-22T08:30:00Z',
        city: 'Frankfurt',
        country: 'Germany',
        organizer: 'Compliance Institute',
        source_url: '#',
        tags: ['compliance', 'risk-management', 'regulatory'],
        attendees: 300,
        price: '€199'
      }
    ]
  },
  {
    id: '2',
    title: 'Trending in Your Industry',
    description: 'Popular events in legal and compliance that are gaining attention',
    category: 'trending',
    confidence: 0.78,
    events: [
      {
        id: '3',
        title: 'AI in Legal Practice Workshop',
        description: 'Hands-on workshop on implementing AI tools in legal practice',
        starts_at: '2024-03-01T10:00:00Z',
        city: 'Munich',
        country: 'Germany',
        organizer: 'AI Legal Society',
        source_url: '#',
        tags: ['ai', 'legal-practice', 'workshop'],
        attendees: 150,
        price: '€149'
      }
    ]
  },
  {
    id: '3',
    title: 'Events Near You',
    description: 'Local events in your preferred locations',
    category: 'location',
    confidence: 0.72,
    events: [
      {
        id: '4',
        title: 'FinTech Legal Forum',
        description: 'Legal challenges and opportunities in financial technology',
        starts_at: '2024-03-10T09:00:00Z',
        city: 'Hamburg',
        country: 'Germany',
        organizer: 'FinTech Legal Network',
        source_url: '#',
        tags: ['fintech', 'legal', 'financial-services'],
        attendees: 200,
        price: '€179'
      }
    ]
  }
];

export const RecommendationsModule = () => {
  const { theme, updateUserBehavior, userBehavior } = useAdaptive();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setRecommendations(mockRecommendations);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleEventClick = (event: Event) => {
    updateUserBehavior({ 
      eventClicks: userBehavior.eventClicks + 1,
      savedEvents: userBehavior.savedEvents + 1
    });
  };

  const handleSaveEvent = (event: Event) => {
    updateUserBehavior({ savedEvents: userBehavior.savedEvents + 1 });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'similar': return Heart;
      case 'trending': return TrendingUp;
      case 'location': return MapPin;
      case 'industry': return Users;
      case 'time': return Clock;
      case 'collaborative': return Users;
      default: return Star;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'similar': return 'text-pink-500';
      case 'trending': return 'text-orange-500';
      case 'location': return 'text-blue-500';
      case 'industry': return 'text-green-500';
      case 'time': return 'text-purple-500';
      case 'collaborative': return 'text-indigo-500';
      default: return 'text-gray-500';
    }
  };

  const filteredRecommendations = selectedCategory === 'all' 
    ? recommendations 
    : recommendations.filter(rec => rec.category === selectedCategory);

  const categories = [
    { id: 'all', label: 'All Recommendations' },
    { id: 'similar', label: 'Similar Events' },
    { id: 'trending', label: 'Trending' },
    { id: 'location', label: 'Near You' },
    { id: 'industry', label: 'Industry Focus' }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Recommendations
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Personalized event suggestions based on your interests
            </p>
          </div>
        </div>

        {/* AI Suggestion */}
        <SuggestionBanner
          suggestion={userBehavior.savedEvents > 0 
            ? `You've saved ${userBehavior.savedEvents} events! We've found similar ones you might like.`
            : "Start saving events you're interested in to get better personalized recommendations."
          }
          onAccept={() => {
            if (userBehavior.savedEvents === 0) {
              // Could trigger a tutorial or guide
            }
          }}
        />
      </div>

      {/* Category Filter */}
      <div className="mb-6">
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
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : theme === 'high-contrast'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Analyzing your preferences...
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {!loading && (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {filteredRecommendations.map((recommendation, index) => {
              const CategoryIcon = getCategoryIcon(recommendation.category);
              
              return (
                <motion.div
                  key={recommendation.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-6 rounded-lg border ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700'
                      : theme === 'high-contrast'
                      ? 'bg-gray-900 border-gray-600'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Recommendation Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <CategoryIcon className={`w-5 h-5 ${getCategoryColor(recommendation.category)}`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {recommendation.title}
                        </h3>
                        <p className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {recommendation.description}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        theme === 'dark'
                          ? 'bg-blue-900/20 text-blue-400'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {(recommendation.confidence * 100).toFixed(0)}% match
                      </span>
                    </div>
                  </div>

                  {/* Events List */}
                  <div className="space-y-3">
                    {recommendation.events.map((event, eventIndex) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: eventIndex * 0.1 }}
                        onClick={() => handleEventClick(event)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                          theme === 'dark'
                            ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                            : theme === 'high-contrast'
                            ? 'bg-gray-800/50 border-gray-500 hover:bg-gray-800'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium mb-2 ${
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            }`}>
                              {event.title}
                            </h4>
                            
                            <p className={`text-sm mb-3 line-clamp-2 ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {event.description}
                            </p>
                            
                            <div className="flex items-center space-x-4 text-sm">
                              <div className={`flex items-center space-x-1 ${
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                <Calendar size={14} />
                                <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                              </div>
                              
                              <div className={`flex items-center space-x-1 ${
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                <MapPin size={14} />
                                <span>{event.city}, {event.country}</span>
                              </div>
                              
                              {event.attendees && (
                                <div className={`flex items-center space-x-1 ${
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  <Users size={14} />
                                  <span>{event.attendees} attendees</span>
                                </div>
                              )}
                              
                              {event.price && (
                                <div className={`flex items-center space-x-1 ${
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
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
                                      ? 'bg-gray-600 text-gray-300'
                                      : 'bg-gray-200 text-gray-600'
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
                                  ? 'hover:bg-gray-600 text-gray-400'
                                  : 'hover:bg-gray-200 text-gray-500'
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
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredRecommendations.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <Heart 
                size={32} 
                className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} 
              />
            </div>
            <h3 className={`text-lg font-medium mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              No recommendations yet
            </h3>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Start searching and saving events to get personalized recommendations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

