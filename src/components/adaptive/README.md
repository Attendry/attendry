# Adaptive Event Discovery Interface

A React + Tailwind prototype of an intelligent event discovery interface that dynamically reconfigures based on user context and behavior patterns.

## Features

### 🧠 Adaptive Layout
- **Collapsible Sidebar**: Automatically collapses when user focuses heavily on event discovery
- **Dynamic Module Switching**: Switches between Search, Recommendations, Trending, Compare, and Insights based on user behavior
- **Responsive Design**: Optimized for different screen sizes

### 🎯 Context-Driven UI
- **Behavioral Tracking**: Monitors search patterns, event interactions, and idle time
- **Smart Module Selection**:
  - Search: Activated when user performs searches
  - Recommendations: Activated when user saves multiple events
  - Compare: Activated after 3+ event clicks
  - Insights: Activated after 10+ seconds of idle time

### 🎨 Adaptive Theming
- **System Preference Detection**: Auto-switches between light/dark themes
- **High Contrast Mode**: Accessibility-focused theme option
- **Smooth Transitions**: All theme changes are animated

### 🤖 Predictive Prompts
- **AI Suggestion Banners**: Context-aware suggestions at the top of each module
- **Smart Recommendations**: Based on current user activity and event discovery patterns
- **Actionable Insights**: Direct actions users can take for event discovery

### 🎭 Microcopy & Icons
- **Contextual Button Labels**: 
  - Search: "Search Events"
  - Recommendations: "Save Event"
  - Compare: "Add to Compare"
  - Insights: "View Insights"
- **Dynamic Icons**: Lucide React icons that change based on context
- **Activity Indicators**: Visual feedback for user discovery state

## Components

### Core Components
- `AdaptiveDashboard`: Main container with context provider
- `Sidebar`: Collapsible navigation with module switching
- `Topbar`: Header with search and user controls
- `MainContent`: Container for module switching

### Modules
- `SearchModule`: Event search with filters and real-time results
- `RecommendationsModule`: Personalized event recommendations
- `TrendingModule`: Trending events with category filtering
- `CompareModule`: Side-by-side event comparison
- `InsightsModule`: AI-powered event discovery analytics

### Utilities
- `SuggestionBanner`: Reusable AI suggestion component
- `ThemeProvider`: Theme context management

## Usage

```tsx
import { AdaptiveDashboard } from '@/components/adaptive/AdaptiveDashboard';

export default function MyPage() {
  return (
    <div className="min-h-screen">
      <AdaptiveDashboard />
    </div>
  );
}
```

## Behavior Simulation

The interface includes mock state tracking to simulate real user behavior:

- **Search Tracking**: Increments when user performs event searches
- **Event Interaction**: Monitors clicks on events and saves
- **Idle Time**: Tracks time since last user activity
- **Activity Indicators**: Visual feedback in the topbar showing discovery state

## Future AI Integration Points

The codebase includes comments marking where real AI/ML services could be integrated:

1. **Behavior Analysis**: Replace mock tracking with real user event discovery analytics
2. **Predictive Suggestions**: Connect to ML models for personalized event recommendations
3. **Content Generation**: Integrate with LLMs for event summarization and smart suggestions
4. **Pattern Recognition**: Use ML to identify user event discovery patterns and preferences

## Styling

- **Tailwind CSS**: Utility-first styling with custom theme variables
- **Framer Motion**: Smooth animations and transitions
- **Responsive Design**: Mobile-first approach with breakpoint optimization
- **Accessibility**: High contrast mode and keyboard navigation support

## Dependencies

- `framer-motion`: Animations and transitions
- `lucide-react`: Icon library
- `react`: UI framework
- `tailwindcss`: Styling framework
