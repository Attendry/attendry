import { EventsSearchRequest, EventsSearchResponseEvent } from './client';

export interface ProgressiveSearchUpdate {
  stage: 'database' | 'cse' | 'firecrawl' | 'complete' | 'error';
  events: EventsSearchResponseEvent[];
  totalSoFar: number;
  isComplete: boolean;
  message?: string;
  error?: string;
  provider?: string;
}

export interface ProgressiveSearchOptions {
  onUpdate: (update: ProgressiveSearchUpdate) => void;
  onComplete: (allEvents: EventsSearchResponseEvent[]) => void;
  onError: (error: Error) => void;
  cancelSignal?: AbortSignal;
}

/**
 * Progressive search client that polls for results as they arrive from different sources
 */
export async function fetchEventsProgressive(
  payload: EventsSearchRequest,
  options: ProgressiveSearchOptions
): Promise<void> {
  const { onUpdate, onComplete, onError, cancelSignal } = options;

  try {
    // Start progressive search
    const response = await fetch('/api/events/run-progressive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: cancelSignal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Search failed' }));
      throw new Error(typeof error?.error === 'string' ? error.error : 'Search failed');
    }

    // Read the response as a stream (Server-Sent Events)
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let buffer = '';
    const allEvents: EventsSearchResponseEvent[] = [];
    let isComplete = false;

    while (!isComplete) {
      // Check for cancellation
      if (cancelSignal?.aborted) {
        reader.cancel();
        return;
      }

      const { done, value } = await reader.read();

      if (done) {
        isComplete = true;
        break;
      }

      // Decode chunk
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (SSE format: "data: {...}\n\n")
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6)) as ProgressiveSearchUpdate;
            
            // Merge events (avoid duplicates)
            const newEvents = data.events.filter(
              (event) => !allEvents.some((e) => e.source_url === event.source_url)
            );
            allEvents.push(...newEvents);

            // Update with merged events
            onUpdate({
              ...data,
              events: allEvents,
              totalSoFar: allEvents.length,
            });

            if (data.isComplete) {
              isComplete = true;
              onComplete(allEvents);
              return;
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }

    // Final completion
    if (allEvents.length > 0) {
      onComplete(allEvents);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Search was cancelled, don't call onError
      return;
    }
    onError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

