'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  GitCompare, 
  Plus, 
  X, 
  MapPin, 
  Calendar, 
  Users,
  Star,
  ExternalLink,
  Bookmark,
  CheckCircle,
  Clock,
  Euro
} from 'lucide-react';
import { useAdaptive } from '../AdaptiveDashboard';
import { SuggestionBanner } from '../SuggestionBanner';

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
  format: 'in-person' | 'virtual' | 'hybrid';
  duration: string;
  language: string;
  level: 'beginner' | 'intermediate' | 'advanced';
}

const mockEvents: Event[] = [
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
    attendees: 800,
    price: '€399',
    format: 'in-person',
    duration: '2 days',
    language: 'English',
    level: 'intermediate'
  },
  {
    id: '2',
    title: 'GDPR Compliance Masterclass',
    description: 'Comprehensive guide to GDPR compliance and data protection best practices',
    starts_at: '2024-03-08T09:00:00Z',
    city: 'Frankfurt',
    country: 'Germany',
    organizer: 'Privacy Institute',
    source_url: '#',
    tags: ['gdpr', 'compliance', 'data-protection'],
    attendees: 500,
    price: '€299',
    format: 'hybrid',
    duration: '1 day',
    language: 'English',
    level: 'beginner'
  },
  {
    id: '3',
    title: 'Legal Automation Workshop',
    description: 'Hands-on workshop on implementing automation in legal workflows',
    starts_at: '2024-03-22T10:00:00Z',
    city: 'Munich',
    country: 'Germany',
    organizer: 'Legal Tech Hub',
    source_url: '#',
    tags: ['automation', 'workflow', 'efficiency'],
    attendees: 200,
    price: '€199',
    format: 'in-person',
    duration: '4 hours',
    language: 'English',
    level: 'advanced'
  }
];

export const CompareModule = () => {
  const { theme, updateUserBehavior, userBehavior } = useAdaptive();
  const [selectedEvents, setSelectedEvents] = useState<Event[]>([]);
  const [availableEvents] = useState<Event[]>(mockEvents);

  const handleAddEvent = (event: Event) => {
    if (selectedEvents.length < 3 && !selectedEvents.find(e => e.id === event.id)) {
      setSelectedEvents(prev => [...prev, event]);
      updateUserBehavior({ eventClicks: userBehavior.eventClicks + 1 });
    }
  };

  const handleRemoveEvent = (eventId: string) => {
    setSelectedEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const handleSaveEvent = (event: Event) => {
    updateUserBehavior({ savedEvents: userBehavior.savedEvents + 1 });
  };

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'in-person': return 'text-green-600';
      case 'virtual': return 'text-blue-600';
      case 'hybrid': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'text-green-600';
      case 'intermediate': return 'text-yellow-600';
      case 'advanced': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Compare Events
            </h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Compare events side-by-side to make informed decisions
            </p>
          </div>
        </div>

        {/* AI Suggestion */}
        <SuggestionBanner
          suggestion={selectedEvents.length === 0 
            ? "Add 2-3 events to compare their features, pricing, and suitability for your needs."
            : `You're comparing ${selectedEvents.length} events. Consider factors like location, timing, and content level.`
          }
          onAccept={() => {
            if (selectedEvents.length === 0) {
              // Could suggest popular events to compare
            }
          }}
        />
      </div>

      {/* Selected Events */}
      {selectedEvents.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Selected Events ({selectedEvents.length}/3)
            </h3>
            <button
              onClick={() => setSelectedEvents([])}
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border relative ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : theme === 'high-contrast'
                    ? 'bg-gray-900 border-gray-600'
                    : 'bg-white border-gray-200'
                }`}
              >
                <button
                  onClick={() => handleRemoveEvent(event.id)}
                  className={`absolute -top-2 -right-2 p-1 rounded-full transition-colors ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                  }`}
                >
                  <X size={16} />
                </button>

                <h4 className={`font-medium mb-2 line-clamp-2 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {event.title}
                </h4>

                <div className="space-y-2 text-sm">
                  <div className={`flex items-center space-x-2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Calendar size={14} />
                    <span>{new Date(event.starts_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className={`flex items-center space-x-2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <MapPin size={14} />
                    <span>{event.city}, {event.country}</span>
                  </div>
                  
                  <div className={`flex items-center space-x-2 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Clock size={14} />
                    <span>{event.duration}</span>
                  </div>
                  
                  {event.price && (
                    <div className={`flex items-center space-x-2 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <Euro size={14} />
                      <span className="font-medium">{event.price}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {selectedEvents.length >= 2 && (
        <div className="mb-6">
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Comparison
          </h3>
          
          <div className={`rounded-lg border overflow-hidden ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${
                  theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                }`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Feature
                    </th>
                    {selectedEvents.map((event) => (
                      <th key={event.id} className={`px-4 py-3 text-left text-sm font-medium ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {event.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Date
                    </td>
                    {selectedEvents.map((event) => (
                      <td key={event.id} className={`px-4 py-3 text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {new Date(event.starts_at).toLocaleDateString()}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Location
                    </td>
                    {selectedEvents.map((event) => (
                      <td key={event.id} className={`px-4 py-3 text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {event.city}, {event.country}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Format
                    </td>
                    {selectedEvents.map((event) => (
                      <td key={event.id} className={`px-4 py-3 text-sm ${getFormatColor(event.format)}`}>
                        {event.format}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Duration
                    </td>
                    {selectedEvents.map((event) => (
                      <td key={event.id} className={`px-4 py-3 text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {event.duration}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Level
                    </td>
                    {selectedEvents.map((event) => (
                      <td key={event.id} className={`px-4 py-3 text-sm ${getLevelColor(event.level)}`}>
                        {event.level}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Price
                    </td>
                    {selectedEvents.map((event) => (
                      <td key={event.id} className={`px-4 py-3 text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {event.price || 'TBD'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Attendees
                    </td>
                    {selectedEvents.map((event) => (
                      <td key={event.id} className={`px-4 py-3 text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {event.attendees || 'TBD'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Available Events */}
      <div className="flex-1 overflow-y-auto">
        <div className="mb-4">
          <h3 className={`text-lg font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Available Events
          </h3>
          <p className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Click to add events for comparison (max 3)
          </p>
        </div>

        <div className="space-y-3">
          {availableEvents.map((event, index) => {
            const isSelected = selectedEvents.find(e => e.id === event.id);
            const canAdd = selectedEvents.length < 3 && !isSelected;
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => canAdd && handleAddEvent(event)}
                className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? theme === 'dark'
                      ? 'bg-blue-900/20 border-blue-500'
                      : theme === 'high-contrast'
                      ? 'bg-blue-900/30 border-blue-400'
                      : 'bg-blue-50 border-blue-500'
                    : canAdd
                    ? theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      : theme === 'high-contrast'
                      ? 'bg-gray-900 border-gray-600 hover:bg-gray-800'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                    : theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 opacity-50'
                    : 'bg-gray-50 border-gray-200 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {event.title}
                      </h4>
                      {isSelected && (
                        <CheckCircle size={16} className="text-green-500" />
                      )}
                    </div>
                    
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
                      
                      <div className={`flex items-center space-x-1 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        <Clock size={14} />
                        <span>{event.duration}</span>
                      </div>
                      
                      {event.price && (
                        <div className={`flex items-center space-x-1 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          <Euro size={14} />
                          <span className="font-medium">{event.price}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {canAdd && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddEvent(event);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : theme === 'high-contrast'
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                    
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
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-gray-600 text-gray-400'
                          : 'hover:bg-gray-200 text-gray-500'
                      }`}
                    >
                      <ExternalLink size={16} />
                    </a>
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
