import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SavedSpeakerProfile } from '@/lib/types/database';

type OutreachStatus = 'not_started' | 'contacted' | 'responded' | 'meeting_scheduled';

interface UseSavedProfilesOptions {
  searchTerm?: string;
  statusFilter?: OutreachStatus | 'all';
  tagFilter?: string | 'all';
  enabled?: boolean;
}

interface UpdateProfilePayload {
  notes?: string;
  tags?: string[];
  outreach_status?: OutreachStatus;
  enhanced_data?: any;
  speaker_data?: any;
  last_enhanced_at?: string | null;
}

export function useSavedProfiles(initialOptions: UseSavedProfilesOptions = {}) {
  const [profiles, setProfiles] = useState<SavedSpeakerProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const {
    searchTerm: initialSearchTerm = '',
    statusFilter: initialStatusFilter = 'all',
    tagFilter: initialTagFilter = 'all',
    enabled = true,
  } = initialOptions;

  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | 'all'>(initialStatusFilter);
  const [tagFilter, setTagFilter] = useState<string | 'all'>(initialTagFilter);
  const enabledRef = useRef<boolean>(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (tagFilter !== 'all') params.append('tag', tagFilter);
    if (searchTerm) params.append('search', searchTerm);
    return params.toString();
  }, [searchTerm, statusFilter, tagFilter]);

  const fetchProfiles = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      if (!enabledRef.current) {
        return;
      }

      const query = buildQueryString();
      const response = await fetch(`/api/profiles/saved${query ? `?${query}` : ''}`, {
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load profiles');
      }

      setProfiles(data.profiles || []);
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') {
        return;
      }
      setError((err as Error).message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    if (!enabled) {
      setProfiles([]);
      setLoading(false);
      setError(null);
      return () => {
        abortControllerRef.current?.abort();
      };
    }

    void fetchProfiles();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchProfiles, enabled]);

  const refresh = useCallback(() => {
    if (!enabledRef.current) {
      return;
    }
    void fetchProfiles();
  }, [fetchProfiles]);

  const mutateProfile = useCallback(
    async (id: string, payload: UpdateProfilePayload, successMessage?: string) => {
      const response = await fetch(`/api/profiles/saved/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || successMessage || 'Failed to update profile');
      }

      return data;
    },
    []
  );

  const updateProfile = useCallback(
    async (id: string, payload: UpdateProfilePayload) => {
      await mutateProfile(id, payload);
      refresh();
    },
    [mutateProfile, refresh]
  );

  const updateStatus = useCallback(
    async (id: string, outreachStatus: OutreachStatus) => {
      await mutateProfile(id, { outreach_status: outreachStatus });
      refresh();
    },
    [mutateProfile, refresh]
  );

  const updateNotes = useCallback(
    async (id: string, notes: string) => {
      await mutateProfile(id, { notes });
      refresh();
    },
    [mutateProfile, refresh]
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/profiles/saved/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete profile');
      }
      refresh();
    },
    [refresh]
  );

  const allTags = useMemo(() => Array.from(new Set(profiles.flatMap((profile) => profile.tags || []))), [profiles]);

  return {
    profiles,
    loading,
    error,
    refresh,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    tagFilter,
    setTagFilter,
    allTags,
    updateProfile,
    updateStatus,
    updateNotes,
    deleteProfile,
  };
}

export type UseSavedProfilesReturn = ReturnType<typeof useSavedProfiles>;

