/**
 * Bulk Save Service
 * Handles bulk saving of speakers as contacts with progress tracking
 */

import { supabaseServer } from '@/lib/supabase-server';
import { SpeakerData } from '@/lib/types/core';
import { checkAutoSaveRateLimitOrThrow } from '@/lib/services/auto-save-rate-limiter';

export interface BulkSaveProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string; // Current speaker being saved
  errors: Array<{ speaker: string; error: string }>;
}

export interface BulkSaveOptions {
  eventId?: string;
  eventTitle?: string;
  onProgress?: (progress: BulkSaveProgress) => void;
  skipRateLimit?: boolean; // For internal use
}

/**
 * Save a single speaker as a contact
 */
async function saveSpeakerAsContact(
  speaker: SpeakerData,
  userId: string,
  options: BulkSaveOptions = {}
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    const supabase = await supabaseServer();
    
    // Check rate limit (unless skipped)
    if (!options.skipRateLimit) {
      try {
        await checkAutoSaveRateLimitOrThrow(userId);
      } catch (rateLimitError: any) {
        return {
          success: false,
          error: rateLimitError.message || 'Rate limit exceeded',
        };
      }
    }

    // Prepare speaker data
    const speakerData = {
      name: speaker.name || '',
      org: speaker.org || speaker.organization || '',
      title: speaker.title || '',
      email: speaker.email || '',
      linkedin: speaker.linkedin_url || speaker.linkedin || '',
      profile_url: speaker.profile_url || '',
      bio: speaker.bio || '',
    };

    // Prepare enhanced data (use existing if available)
    const enhancedData = speaker.enhanced_data || {
      name: speakerData.name,
      organization: speakerData.org,
      title: speakerData.title,
    };

    // Check if already saved
    const { data: existing } = await supabase
      .from('saved_speaker_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('speaker_data->>name', speakerData.name)
      .eq('speaker_data->>org', speakerData.org)
      .single();

    if (existing) {
      return {
        success: false,
        error: 'Already saved',
        contactId: existing.id,
      };
    }

    // Save contact
    const { data, error } = await supabase
      .from('saved_speaker_profiles')
      .insert({
        user_id: userId,
        speaker_data: speakerData,
        enhanced_data: enhancedData,
        tags: [],
        outreach_status: 'not_started',
        data_source: 'manual',
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation - already saved
        return {
          success: false,
          error: 'Already saved',
        };
      }
      throw error;
    }

    // Record contact creation for rate limiting
    if (data?.id && !options.skipRateLimit) {
      try {
        const { getAutoSaveRateLimiter } = await import('@/lib/services/auto-save-rate-limiter');
        const rateLimiter = getAutoSaveRateLimiter();
        await rateLimiter.recordContactCreation(userId);
      } catch (rateLimitError) {
        console.warn('[bulk-save] Failed to record contact creation:', rateLimitError);
      }
    }

    return {
      success: true,
      contactId: data.id,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to save contact',
    };
  }
}

/**
 * Bulk save speakers as contacts
 */
export async function bulkSaveSpeakers(
  speakers: SpeakerData[],
  userId: string,
  options: BulkSaveOptions = {}
): Promise<BulkSaveProgress> {
  const progress: BulkSaveProgress = {
    total: speakers.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  // Check rate limit upfront (unless skipped)
  if (!options.skipRateLimit && speakers.length > 0) {
    try {
      await checkAutoSaveRateLimitOrThrow(userId);
    } catch (rateLimitError: any) {
      // If rate limit exceeded, mark all as failed
      progress.failed = speakers.length;
      speakers.forEach(speaker => {
        progress.errors.push({
          speaker: speaker.name || 'Unknown',
          error: rateLimitError.message || 'Rate limit exceeded',
        });
      });
      if (options.onProgress) {
        options.onProgress(progress);
      }
      return progress;
    }
  }

  // Save speakers sequentially to respect rate limits
  for (let i = 0; i < speakers.length; i++) {
    const speaker = speakers[i];
    progress.current = speaker.name || `Speaker ${i + 1}`;

    if (options.onProgress) {
      options.onProgress(progress);
    }

    const result = await saveSpeakerAsContact(speaker, userId, {
      ...options,
      skipRateLimit: i > 0, // Only check rate limit for first speaker
    });

    if (result.success) {
      progress.completed++;
    } else {
      progress.failed++;
      if (result.error && result.error !== 'Already saved') {
        progress.errors.push({
          speaker: speaker.name || 'Unknown',
          error: result.error,
        });
      }
    }

    // Small delay to avoid overwhelming the system
    if (i < speakers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  progress.current = undefined;
  if (options.onProgress) {
    options.onProgress(progress);
  }

  return progress;
}

