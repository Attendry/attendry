"use client";

import React from 'react';
import { X, Sparkles, Search, Users, Target, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

export function WelcomeModal({ isOpen, onClose, onStartTour }: WelcomeModalProps) {
  if (!isOpen) return null;

  const features = [
    {
      icon: Search,
      title: "Find Events",
      description: "Search for conferences where your target accounts will be"
    },
    {
      icon: Users,
      title: "See Attendees",
      description: "View speakers, sponsors, and participating companies"
    },
    {
      icon: Target,
      title: "Track Outreach",
      description: "Save prospects and manage your sales pipeline"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-8 pb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Welcome to Attendry
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your sales intelligence hub for event-based prospecting
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
              Turn Events Into Your Sales Pipeline
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Attendry helps you find events where your target accounts will be, see who's attending, 
              and turn event attendees into warm prospects for outreach.
            </p>
          </div>

          {/* Quick Start Steps */}
          <div className="space-y-4 mb-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
              Quick Start
            </h4>
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <feature.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h5 className="font-semibold text-slate-900 dark:text-white">
                      {feature.title}
                    </h5>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Key Features */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              What You Can Do Here
            </h4>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <li>• Search for events using natural language or filters</li>
              <li>• See speakers, sponsors, and attendees at each event</li>
              <li>• Save prospects to your watchlist for outreach</li>
              <li>• Track outreach status and move opportunities through your pipeline</li>
              <li>• Get competitive intelligence on events your competitors attend</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            Skip for now
          </button>
          <div className="flex gap-3">
            {onStartTour && (
              <Button
                onClick={onStartTour}
                variant="outline"
                className="flex items-center gap-2"
              >
                Take a Tour
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={onClose}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


