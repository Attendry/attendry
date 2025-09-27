/**
 * Component Type Definitions for Attendry Application
 * 
 * This file contains type definitions for React components,
 * their props, state, and event handlers.
 */

import { EventData, SpeakerData, UserProfile } from './core';

/**
 * EventCard component props
 */
export interface EventCardProps {
  ev: EventData;
  initiallySaved?: boolean;
  onSave?: (eventId: string, saved: boolean) => void;
  onExpand?: (eventId: string) => void;
  showSpeakers?: boolean;
  compact?: boolean;
}

/**
 * EventCard component state
 */
export interface EventCardState {
  saved: boolean;
  busy: boolean;
  open: boolean;
  includePast: boolean;
  loadingSpeakers: boolean;
  speakers: SpeakerData[] | null;
  followed: string[];
}

/**
 * SpeakerCard component props
 */
export interface SpeakerCardProps {
  speaker: SpeakerData;
  sessionTitle?: string;
  onFollow?: (speakerId: string) => void;
  onUnfollow?: (speakerId: string) => void;
  isFollowed?: boolean;
  compact?: boolean;
}

/**
 * SpeakerCard component state
 */
export interface SpeakerCardState {
  isFollowed: boolean;
  loading: boolean;
  expanded: boolean;
}

/**
 * SearchForm component props
 */
export interface SearchFormProps {
  onSearch: (params: SearchFormParams) => void;
  loading?: boolean;
  initialValues?: Partial<SearchFormParams>;
  showAdvanced?: boolean;
  onToggleAdvanced?: (show: boolean) => void;
}

/**
 * SearchForm component state
 */
export interface SearchFormState {
  country: string;
  range: 'next' | 'past';
  days: 7 | 14 | 30;
  advanced: boolean;
  from: string;
  to: string;
  keywords: string;
  loading: boolean;
  error: string;
}

/**
 * Search form parameters
 */
export interface SearchFormParams {
  country: string;
  from: string;
  to: string;
  keywords: string;
  provider?: string;
}

/**
 * EventsClient component props
 */
export interface EventsClientProps {
  initialSavedSet: Set<string>;
  initialEvents?: EventData[];
  onEventsChange?: (events: EventData[]) => void;
}

/**
 * EventsClient component state
 */
export interface EventsClientState {
  events: EventData[];
  loading: boolean;
  error: string;
  debug: any;
  savedEvents: Set<string>;
}

/**
 * Layout component props
 */
export interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showHeader?: boolean;
  className?: string;
}

/**
 * Header component props
 */
export interface HeaderProps {
  user?: {
    id: string;
    email?: string;
  } | null;
  onLogin?: () => void;
  onLogout?: () => void;
  showAuth?: boolean;
}

/**
 * Header component state
 */
export interface HeaderState {
  user: any | null;
  authReady: boolean;
  menuOpen: boolean;
}

/**
 * Sidebar component props
 */
export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  currentPath?: string;
}

/**
 * Sidebar component state
 */
export interface SidebarState {
  isOpen: boolean;
  activeItem: string;
}

/**
 * TopBar component props
 */
export interface TopBarProps {
  onMenuClick: () => void;
  title?: string;
  showMenu?: boolean;
  user?: any;
}

/**
 * TopBar component state
 */
export interface TopBarState {
  menuOpen: boolean;
  notifications: number;
}

/**
 * AuthBadge component props
 */
export interface AuthBadgeProps {
  user?: any;
  onLogin?: () => void;
  onLogout?: () => void;
  showProfile?: boolean;
}

/**
 * AuthHelper component props
 */
export interface AuthHelperProps {
  onAuthChange?: (authenticated: boolean) => void;
  showDebug?: boolean;
}

/**
 * AuthHelper component state
 */
export interface AuthHelperState {
  authenticated: boolean;
  user: any | null;
  loading: boolean;
  error: string;
}

/**
 * SetupStatusIndicator component props
 */
export interface SetupStatusIndicatorProps {
  showDetails?: boolean;
  onStatusChange?: (status: 'ready' | 'warning' | 'error') => void;
}

/**
 * SetupStatusIndicator component state
 */
export interface SetupStatusIndicatorState {
  status: 'ready' | 'warning' | 'error';
  details: string[];
  loading: boolean;
}

/**
 * AttendeeCard component props
 */
export interface AttendeeCardProps {
  attendee: {
    name: string;
    company?: string;
    title?: string;
    avatar?: string;
    linkedin?: string;
  };
  onConnect?: (attendeeId: string) => void;
  showConnect?: boolean;
}

/**
 * AttendeeCard component state
 */
export interface AttendeeCardState {
  connecting: boolean;
  connected: boolean;
}

/**
 * EnhancedSpeakerCard component props
 */
export interface EnhancedSpeakerCardProps {
  speaker: SpeakerData;
  sessionTitle?: string;
  onFollow?: (speakerId: string) => void;
  onUnfollow?: (speakerId: string) => void;
  isFollowed?: boolean;
  showBio?: boolean;
  showSocial?: boolean;
}

/**
 * EnhancedSpeakerCard component state
 */
export interface EnhancedSpeakerCardState {
  isFollowed: boolean;
  loading: boolean;
  expanded: boolean;
  bioExpanded: boolean;
}

/**
 * Watchlist component props
 */
export interface WatchlistProps {
  userId: string;
  onItemClick?: (item: any) => void;
  onItemRemove?: (itemId: string) => void;
  showFilters?: boolean;
}

/**
 * Watchlist component state
 */
export interface WatchlistState {
  items: any[];
  loading: boolean;
  error: string;
  filter: 'all' | 'events' | 'speakers' | 'organizations';
  sortBy: 'date' | 'name' | 'type';
}

/**
 * Profile component props
 */
export interface ProfileProps {
  user: UserProfile;
  onSave?: (profile: UserProfile) => void;
  onCancel?: () => void;
  editable?: boolean;
}

/**
 * Profile component state
 */
export interface ProfileState {
  profile: UserProfile;
  loading: boolean;
  saving: boolean;
  error: string;
  hasChanges: boolean;
}

/**
 * SearchResults component props
 */
export interface SearchResultsProps {
  events: EventData[];
  loading: boolean;
  error?: string;
  onEventClick?: (event: EventData) => void;
  onEventSave?: (event: EventData, saved: boolean) => void;
  showFilters?: boolean;
  showSort?: boolean;
}

/**
 * SearchResults component state
 */
export interface SearchResultsState {
  filteredEvents: EventData[];
  sortBy: 'date' | 'relevance' | 'title';
  sortOrder: 'asc' | 'desc';
  filters: {
    dateRange: string;
    country: string;
    eventType: string;
  };
}

/**
 * FilterPanel component props
 */
export interface FilterPanelProps {
  onFiltersChange: (filters: any) => void;
  initialFilters?: any;
  availableOptions?: {
    countries: string[];
    eventTypes: string[];
    dateRanges: string[];
  };
}

/**
 * FilterPanel component state
 */
export interface FilterPanelState {
  filters: any;
  expanded: boolean;
}

/**
 * Pagination component props
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  itemsPerPage?: number;
  totalItems?: number;
}

/**
 * Pagination component state
 */
export interface PaginationState {
  currentPage: number;
  totalPages: number;
}

/**
 * LoadingSpinner component props
 */
export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
  overlay?: boolean;
}

/**
 * ErrorBoundary component props
 */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  onError?: (error: Error, errorInfo: any) => void;
}

/**
 * ErrorBoundary component state
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Modal component props
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'full';
  closable?: boolean;
}

/**
 * Modal component state
 */
export interface ModalState {
  isOpen: boolean;
  isClosing: boolean;
}

/**
 * Toast component props
 */
export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Toast component state
 */
export interface ToastState {
  visible: boolean;
  timer: NodeJS.Timeout | null;
}

/**
 * Form field component props
 */
export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  value: any;
  onChange: (value: any) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: any; label: string }>;
  disabled?: boolean;
}

/**
 * Form field component state
 */
export interface FormFieldState {
  focused: boolean;
  touched: boolean;
}

/**
 * Button component props
 */
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Button component state
 */
export interface ButtonState {
  pressed: boolean;
  loading: boolean;
}
