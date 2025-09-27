'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  TrendingUp, 
  Clock, 
  Target, 
  Lightbulb, 
  BarChart3,
  Calendar,
  Users,
  Zap,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';

interface Insight {
  id: string;
  type: 'discovery' | 'suggestion' | 'trend' | 'alert' | 'preference';
  title: string;
  description: string;
  action?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

const mockInsights: Insight[] = [
  {
    id: '1',
    type: 'discovery',
    title: 'Event Discovery Pattern',
    description: 'You search for events most actively on Tuesday mornings. Consider setting up alerts for new events.',
    action: 'Set up event alerts',
    priority: 'medium',
    category: 'Discovery Behavior'
  },
  {
    id: '2',
    type: 'preference',
    title: 'Location Preferences',
    description: 'You\'ve shown strong interest in events in Germany and Netherlands. We\'re prioritizing these regions.',
    action: 'Update location preferences',
    priority: 'high',
    category: 'Preferences'
  },
  {
    id: '3',
    type: 'trend',
    title: 'Industry Interest Growth',
    description: 'Your interest in AI & Legal Tech events has increased by 60% this month.',
    action: 'Explore more AI events',
    priority: 'low',
    category: 'Interest Trends'
  },
  {
    id: '4',
    type: 'alert',
    title: 'Idle Time Alert',
    description: 'You\'ve been idle for 10+ minutes. Here are some trending events you might be interested in.',
    action: 'Browse trending events',
    priority: 'high',
    category: 'Engagement'
  },
  {
    id: '5',
    type: 'suggestion',
    title: 'Event Comparison Opportunity',
    description: 'You\'ve clicked on 3 similar events. Consider using the compare feature to make a decision.',
    action: 'Compare events',
    priority: 'medium',
    category: 'Decision Making'
  }
];

export const InsightsModule = () => {
  const { theme, userBehavior } = useAdaptive();
  const [insights] = useState<Insight[]>(mockInsights);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', 'Discovery Behavior', 'Preferences', 'Interest Trends', 'Engagement', 'Decision Making'];
  
  const filteredInsights = selectedCategory === 'all' 
    ? insights 
    : insights.filter(insight => insight.category === selectedCategory);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'discovery': return TrendingUp;
      case 'suggestion': return Lightbulb;
      case 'trend': return BarChart3;
      case 'alert': return AlertCircle;
      case 'preference': return Star;
      default: return Info;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'discovery': return 'text-green-500';
      case 'suggestion': return 'text-blue-500';
      case 'trend': return 'text-purple-500';
      case 'alert': return 'text-orange-500';
      case 'preference': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStats = () => {
    const totalSearches = userBehavior.searchCount;
    const eventsClicked = userBehavior.eventClicks;
    const eventsSaved = userBehavior.savedEvents;
    const idleTime = Math.floor(userBehavior.idleTime / 1000);
    
    return {
      totalSearches,
      eventsClicked,
      eventsSaved,
      idleTime,
      discoveryRate: totalSearches > 0 ? Math.round((eventsClicked / totalSearches) * 100) : 0
    };
  };

  const stats = getStats();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Insights
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              AI-powered analytics and suggestions
            </p>
          </div>
        </div>

        {/* AI Suggestion */}
        <SuggestionBanner
          suggestion={userBehavior.idleTime > 10000 
            ? "You've been idle—check out trending events in your industry?" 
            : "Your event discovery is active! Consider exploring recommendations based on your interests."
          }
          onAccept={() => {
            if (userBehavior.idleTime > 10000) {
              // Could trigger trending events view
            }
          }}
        />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : theme === 'high-contrast'
              ? 'bg-gray-900 border-gray-600'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Events Saved
              </p>
              <p className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {stats.eventsSaved}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : theme === 'high-contrast'
              ? 'bg-gray-900 border-gray-600'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Discovery Rate
              </p>
              <p className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {stats.discoveryRate}%
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : theme === 'high-contrast'
              ? 'bg-gray-900 border-gray-600'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Events Clicked
              </p>
              <p className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {stats.eventsClicked}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : theme === 'high-contrast'
              ? 'bg-gray-900 border-gray-600'
              : 'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Searches
              </p>
              <p className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {stats.totalSearches}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex space-x-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                selectedCategory === category
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
              {category === 'all' ? 'All Insights' : category}
            </button>
          ))}
        </div>
      </div>

      {/* Insights List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {filteredInsights.map((insight, index) => {
            const Icon = getInsightIcon(insight.type);
            
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-6 rounded-lg border transition-all duration-200 ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-6 h-6 ${getInsightColor(insight.type)}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {insight.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(insight.priority)}`}>
                        {insight.priority}
                      </span>
                    </div>
                    
                    <p className={`text-sm mb-3 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {insight.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {insight.category}
                      </span>
                      
                      {insight.action && (
                        <button
                          className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            theme === 'dark'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : theme === 'high-contrast'
                              ? 'bg-blue-500 hover:bg-blue-600 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          <Zap size={14} />
                          <span>{insight.action}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
