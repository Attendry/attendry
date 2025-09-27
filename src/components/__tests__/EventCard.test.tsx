/**
 * EventCard Component Tests
 * 
 * This file contains tests for the EventCard component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mockFetch, mockUser, mockEvent } from '../../__tests__/utils/test-utils';
import EventCard from '../EventCard';

// Mock the EventCard component dependencies
jest.mock('@/lib/http', () => ({
  post: jest.fn(),
}));

describe('EventCard', () => {
  beforeEach(() => {
    mockFetch({ success: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders event information correctly', () => {
    render(<EventCard ev={mockEvent} />);
    
    expect(screen.getByText(mockEvent.title)).toBeInTheDocument();
    expect(screen.getByText(mockEvent.city)).toBeInTheDocument();
    expect(screen.getByText(mockEvent.country)).toBeInTheDocument();
    expect(screen.getByText(mockEvent.organizer)).toBeInTheDocument();
  });

  it('displays formatted date correctly', () => {
    render(<EventCard ev={mockEvent} />);
    
    const dateElement = screen.getByText(/Dec 1, 2024/);
    expect(dateElement).toBeInTheDocument();
  });

  it('handles save button click', async () => {
    render(<EventCard ev={mockEvent} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(saveButton).toHaveTextContent('Saved');
    });
  });

  it('handles unsave button click', async () => {
    render(<EventCard ev={mockEvent} initiallySaved={true} />);
    
    const unsaveButton = screen.getByText('Saved');
    fireEvent.click(unsaveButton);
    
    await waitFor(() => {
      expect(unsaveButton).toHaveTextContent('Save');
    });
  });

  it('shows loading state when saving', async () => {
    render(<EventCard ev={mockEvent} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('handles comparison button click', () => {
    const onAddToComparison = jest.fn();
    render(<EventCard ev={mockEvent} onAddToComparison={onAddToComparison} />);
    
    const compareButton = screen.getByText('Compare');
    fireEvent.click(compareButton);
    
    expect(onAddToComparison).toHaveBeenCalledWith(mockEvent);
  });

  it('does not show comparison button when callback not provided', () => {
    render(<EventCard ev={mockEvent} />);
    
    expect(screen.queryByText('Compare')).not.toBeInTheDocument();
  });

  it('displays event description when available', () => {
    render(<EventCard ev={mockEvent} />);
    
    expect(screen.getByText(mockEvent.description)).toBeInTheDocument();
  });

  it('handles missing event data gracefully', () => {
    const incompleteEvent = {
      ...mockEvent,
      title: undefined,
      city: undefined,
      country: undefined,
    };
    
    render(<EventCard ev={incompleteEvent} />);
    
    // Should not crash and should render something
    expect(screen.getByTestId('event-card')).toBeInTheDocument();
  });

  it('formats time range correctly', () => {
    const eventWithTimeRange = {
      ...mockEvent,
      starts_at: '2024-12-01T09:00:00Z',
      ends_at: '2024-12-01T17:00:00Z',
    };
    
    render(<EventCard ev={eventWithTimeRange} />);
    
    expect(screen.getByText(/9:00 AM - 5:00 PM/)).toBeInTheDocument();
  });

  it('shows venue information when available', () => {
    render(<EventCard ev={mockEvent} />);
    
    expect(screen.getByText(mockEvent.venue)).toBeInTheDocument();
  });

  it('handles error state when save fails', async () => {
    mockFetch({ error: 'Save failed' }, false);
    
    render(<EventCard ev={mockEvent} />);
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(saveButton).toHaveTextContent('Save');
    });
  });

  it('displays topics when available', () => {
    render(<EventCard ev={mockEvent} />);
    
    mockEvent.topics?.forEach(topic => {
      expect(screen.getByText(topic)).toBeInTheDocument();
    });
  });

  it('handles click on event title', () => {
    render(<EventCard ev={mockEvent} />);
    
    const titleLink = screen.getByText(mockEvent.title);
    expect(titleLink.closest('a')).toHaveAttribute('href', mockEvent.source_url);
    expect(titleLink.closest('a')).toHaveAttribute('target', '_blank');
  });
});
