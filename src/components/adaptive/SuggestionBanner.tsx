'use client';

import { motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { useAdaptive } from './AdaptiveDashboard';
import { useState } from 'react';

interface SuggestionBannerProps {
  suggestion: string;
  onDismiss?: () => void;
  onAccept?: () => void;
}

export const SuggestionBanner = ({ 
  suggestion, 
  onDismiss, 
  onAccept 
}: SuggestionBannerProps) => {
  const { theme } = useAdaptive();
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleAccept = () => {
    onAccept?.();
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className={`mb-6 p-4 rounded-lg border-l-4 ${
        theme === 'dark'
          ? 'bg-blue-900/20 border-blue-500 text-blue-200'
          : theme === 'high-contrast'
          ? 'bg-blue-900/30 border-blue-400 text-blue-100'
          : 'bg-blue-50 border-blue-500 text-blue-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <Lightbulb 
            size={20} 
            className={`mt-0.5 ${
              theme === 'dark' 
                ? 'text-blue-400' 
                : theme === 'high-contrast'
                ? 'text-blue-300'
                : 'text-blue-600'
            }`} 
          />
          <div>
            <p className="font-medium mb-1">AI Suggestion</p>
            <p className="text-sm opacity-90">{suggestion}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {onAccept && (
            <button
              onClick={handleAccept}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : theme === 'high-contrast'
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Accept
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`p-1 rounded transition-colors ${
              theme === 'dark'
                ? 'hover:bg-blue-800/30 text-blue-300'
                : theme === 'high-contrast'
                ? 'hover:bg-blue-800/40 text-blue-200'
                : 'hover:bg-blue-100 text-blue-600'
            }`}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
