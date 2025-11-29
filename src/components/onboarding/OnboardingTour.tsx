"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TourStep {
  id: string;
  target: string; // CSS selector or data attribute
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingTourProps {
  steps: TourStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ steps, isActive, onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || steps.length === 0) return;

    const updateTarget = () => {
      const step = steps[currentStep];
      if (!step) return;

      // Try to find element by selector or data attribute
      let element: HTMLElement | null = null;
      
      try {
        if (step.target.startsWith('[') && step.target.endsWith(']')) {
          // Data attribute selector - extract the attribute name
          const attrMatch = step.target.match(/\[data-tour="([^"]+)"\]/);
          if (attrMatch) {
            const attrValue = attrMatch[1];
            element = document.querySelector(`[data-tour="${attrValue}"]`) as HTMLElement;
          }
        } else {
          // CSS selector
          element = document.querySelector(step.target) as HTMLElement;
        }
      } catch (error) {
        console.warn('OnboardingTour: Error finding target element:', error);
        // If element not found, skip to next step or complete
        if (currentStep < steps.length - 1) {
          setTimeout(() => setCurrentStep(currentStep + 1), 500);
        } else {
          onComplete();
        }
        return;
      }

      setTargetElement(element);
      
      if (element) {
        // Scroll element into view with a small delay to ensure it's rendered
        setTimeout(() => {
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        // Element not found - wait a bit and try again, or skip
        console.warn(`OnboardingTour: Target element not found: ${step.target}`);
      }
    };

    // Add a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateTarget();
    }, 200);
    
    // Update on scroll/resize
    const handleUpdate = () => updateTarget();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, currentStep, steps, onComplete]);

  if (!isActive || steps.length === 0 || currentStep >= steps.length) {
    return null;
  }

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!targetElement || !tooltipRef.current) return { top: 0, left: 0 };

    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const position = step.position || 'bottom';
    const spacing = 12;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - spacing;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + spacing;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.right + spacing;
        break;
    }

    // Keep tooltip in viewport
    const padding = 16;
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

    return { top, left };
  };

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirst) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAction = () => {
    if (step.action) {
      step.action.onClick();
    }
    handleNext();
  };

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onSkip}
      />

      {/* Highlighted Element */}
      {targetElement && (
        <div
          className="fixed z-[41] border-4 border-blue-500 rounded-lg pointer-events-none shadow-2xl"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-sm w-full mx-4"
        style={getTooltipPosition()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {currentStep + 1}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {step.content}
              </p>
            </div>
            <button
              onClick={onSkip}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-2"
              aria-label="Skip tour"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Button */}
          {step.action && (
            <div className="mb-4">
              <Button
                onClick={handleAction}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                {step.action.label}
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Step {currentStep + 1} of {steps.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrevious}
                disabled={isFirst}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                onClick={handleNext}
                size="sm"
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700"
              >
                {isLast ? 'Finish' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

