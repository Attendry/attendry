'use client';

import { motion } from 'framer-motion';
import { memo, useMemo, useCallback } from 'react';
import { 
  Plus,
  Filter,
  Sparkles,
  Settings,
  Bell,
  Search,
  Download,
  Share2
} from 'lucide-react';
import { useAdaptive } from './PremiumAdaptiveDashboard';

const PremiumActionRail = memo(() => {
  const { 
    currentModule, 
    theme,
    userBehavior,
    adaptiveMode
  } = useAdaptive();

  // Context-aware actions based on current module
  const contextActions = useMemo(() => {
    const baseActions = [
      { id: 'search', icon: Search, label: 'Search', primary: true },
      { id: 'filter', icon: Filter, label: 'Filter', primary: false },
    ];

    switch (currentModule) {
      case 'search':
        return [
          { id: 'new-search', icon: Plus, label: 'New Search', primary: true },
          { id: 'filter', icon: Filter, label: 'Filter', primary: false },
          { id: 'ai-suggest', icon: Sparkles, label: 'AI Suggest', primary: false },
        ];
      case 'recommendations':
        return [
          { id: 'refresh', icon: Sparkles, label: 'Refresh', primary: true },
          { id: 'save', icon: Plus, label: 'Save', primary: false },
          { id: 'share', icon: Share2, label: 'Share', primary: false },
        ];
      case 'trending':
        return [
          { id: 'export', icon: Download, label: 'Export', primary: true },
          { id: 'filter', icon: Filter, label: 'Filter', primary: false },
          { id: 'notify', icon: Bell, label: 'Notify', primary: false },
        ];
      case 'compare':
        return [
          { id: 'add-event', icon: Plus, label: 'Add Event', primary: true },
          { id: 'export', icon: Download, label: 'Export', primary: false },
          { id: 'share', icon: Share2, label: 'Share', primary: false },
        ];
      case 'insights':
        return [
          { id: 'generate', icon: Sparkles, label: 'Generate', primary: true },
          { id: 'export', icon: Download, label: 'Export', primary: false },
          { id: 'settings', icon: Settings, label: 'Settings', primary: false },
        ];
      default:
        return baseActions;
    }
  }, [currentModule]);

  const handleActionClick = useCallback((actionId: string) => {
    // Adaptive state machine integration point
    console.log(`Action clicked: ${actionId} in module: ${currentModule}`);
    
    // Here you would integrate with the adaptive state machine
    // to track user behavior and potentially trigger UI adaptations
  }, [currentModule]);

  return (
    <motion.div
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="w-20 h-full bg-[#1A1F2C] border-l border-[#2D3344] flex flex-col items-center py-6 space-y-4"
    >
      {/* Primary Action */}
      {contextActions[0] && (() => {
        const PrimaryIcon = contextActions[0].icon;
        return (
          <motion.button
            onClick={() => handleActionClick(contextActions[0].id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-12 h-12 bg-[#4ADE80] rounded-2xl flex items-center justify-center shadow-lg hover:shadow-[#4ADE80]/25 transition-all duration-150"
          >
            <PrimaryIcon size={20} className="text-white" />
          </motion.button>
        );
      })()}

      {/* Secondary Actions */}
      <div className="flex flex-col space-y-2">
        {contextActions.slice(1).map((action) => {
          const ActionIcon = action.icon;
          return (
            <motion.button
              key={action.id}
              onClick={() => handleActionClick(action.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 bg-[#2D3344] rounded-2xl flex items-center justify-center hover:bg-[#2D3344]/80 transition-colors duration-150 group"
              title={action.label}
            >
              <ActionIcon size={18} className="text-[#9CA3AF] group-hover:text-[#E6E8EC] transition-colors duration-150" />
            </motion.button>
          );
        })}
      </div>

      {/* Adaptive Mode Indicator */}
      <div className="mt-auto">
        <div className={`w-3 h-3 rounded-full transition-colors duration-150 ${
          adaptiveMode 
            ? 'bg-[#4ADE80] shadow-lg shadow-[#4ADE80]/25' 
            : 'bg-[#2D3344]'
        }`} />
      </div>

      {/* Activity Indicator */}
      <div className="flex flex-col items-center space-y-2">
        <div className={`w-2 h-2 rounded-full ${
          userBehavior.idleTime > 30000 
            ? 'bg-[#9CA3AF]' 
            : userBehavior.searchCount > 0 || userBehavior.eventClicks > 0
            ? 'bg-[#4ADE80]'
            : 'bg-[#2D3344]'
        }`} />
        <div className="text-[#9CA3AF] text-xs font-mono">
          {userBehavior.idleTime > 30000 ? 'IDLE' : 'ACTIVE'}
        </div>
      </div>
    </motion.div>
  );
});

PremiumActionRail.displayName = 'PremiumActionRail';

export { PremiumActionRail };
