import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MAX_PROFILES, makeId, parseStoredProfiles, validateProfileInput } from './profiles';
import type { Profile, ProfileInput } from '../types';

const PROFILES_KEY = 'storytime:profiles:v1';

type ProfilesState = { profiles: Profile[]; activeId: string | null };
const EMPTY: ProfilesState = { profiles: [], activeId: null };

type ProfilesContextValue = {
  /** True once the saved profiles have been read (or the read failed). */
  ready: boolean;
  /**
   * True only when the saved profiles were read successfully (a missing or corrupt value counts).
   * When false, `profiles` may not reflect what is saved, so nothing is persisted and consumers
   * must not delete data for profiles that seem to be missing.
   */
  trusted: boolean;
  profiles: Profile[];
  activeProfile: Profile | null;
  activeId: string | null;
  setActive: (id: string) => void;
  createProfile: (input: ProfileInput) => Profile | null;
  updateProfile: (id: string, input: ProfileInput) => void;
  deleteProfile: (id: string) => void;
};

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProfilesState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [trusted, setTrusted] = useState(false);
  // Mirrors `state` synchronously so createProfile can return the new profile (or null at the cap).
  const latest = useRef<ProfilesState>(EMPTY);

  const commit = useCallback((next: ProfilesState) => {
    latest.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = parseStoredProfiles(await AsyncStorage.getItem(PROFILES_KEY));
        if (!cancelled) {
          commit(saved);
          setTrusted(true);
        }
      } catch {
        // storage unavailable: work in memory and never overwrite what is saved
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [commit]);

  // Persist only after a successful load so we never overwrite saved data with EMPTY.
  useEffect(() => {
    if (!trusted) return;
    AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, trusted]);

  const setActive = useCallback(
    (id: string) => {
      const current = latest.current;
      if (!current.profiles.some((p) => p.id === id)) return;
      commit({ ...current, activeId: id });
    },
    [commit],
  );

  const createProfile = useCallback(
    (input: ProfileInput): Profile | null => {
      const current = latest.current;
      if (current.profiles.length >= MAX_PROFILES) return null;
      const result = validateProfileInput(input);
      if (!result.ok) return null;
      const profile: Profile = { id: makeId(), color: input.color, ...result.value };
      commit({ profiles: [...current.profiles, profile], activeId: profile.id });
      return profile;
    },
    [commit],
  );

  const updateProfile = useCallback(
    (id: string, input: ProfileInput) => {
      const current = latest.current;
      const result = validateProfileInput(input);
      if (!result.ok || !current.profiles.some((p) => p.id === id)) return;
      const profiles = current.profiles.map((p) =>
        p.id === id ? { id, color: input.color, ...result.value } : p,
      );
      commit({ ...current, profiles });
    },
    [commit],
  );

  const deleteProfile = useCallback(
    (id: string) => {
      const current = latest.current;
      if (!current.profiles.some((p) => p.id === id)) return;
      const profiles = current.profiles.filter((p) => p.id !== id);
      const activeId = current.activeId === id ? (profiles[0]?.id ?? null) : current.activeId;
      commit({ profiles, activeId });
    },
    [commit],
  );

  const value = useMemo<ProfilesContextValue>(
    () => ({
      ready,
      trusted,
      profiles: state.profiles,
      activeProfile: state.profiles.find((p) => p.id === state.activeId) ?? null,
      activeId: state.activeId,
      setActive,
      createProfile,
      updateProfile,
      deleteProfile,
    }),
    [ready, trusted, state, setActive, createProfile, updateProfile, deleteProfile],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used inside ProfilesProvider');
  return ctx;
}
