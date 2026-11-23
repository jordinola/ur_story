import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { loadCatalog } from './catalog';
import { useProfiles } from './ProfilesProvider';
import type { LibraryState, Profile, Story } from '../types';

const STATE_KEY = 'storytime:library:v2';
/** Pre-profiles format. Only ever read (to migrate into `shared`); never written or deleted. */
const V1_STATE_KEY = 'storytime:library:v1';
const EMPTY: LibraryState = { favorites: [], progress: {}, completed: [] };

/** `shared` is used while no profile is active; each profile reads and writes its own slice. */
type StoredLibrary = { shared: LibraryState; byProfile: Record<string, LibraryState> };
const EMPTY_LIBRARY: StoredLibrary = { shared: EMPTY, byProfile: {} };

type LibraryContextValue = {
  stories: Story[];
  /** True once saved state and profiles have both loaded. */
  ready: boolean;
  /** True until saved state, profiles and the first catalog (cached or bundled) have all loaded. */
  loading: boolean;
  favorites: string[];
  /** Playback position in seconds per story id, for the active profile. */
  progress: Record<string, number>;
  completed: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  getProgress: (id: string) => number;
  saveProgress: (id: string, seconds: number) => void;
  markCompleted: (id: string) => void;
  isCompleted: (id: string) => boolean;
  getStory: (id: string) => Story | undefined;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function toProgress(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  );
  return Object.fromEntries(entries);
}

function toLibraryState(value: unknown): LibraryState {
  if (!isRecord(value)) return EMPTY;
  return {
    favorites: isStringArray(value.favorites) ? value.favorites : [],
    progress: toProgress(value.progress),
    completed: isStringArray(value.completed) ? value.completed : [],
  };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toStoredLibrary(value: Record<string, unknown>): StoredLibrary {
  const slices = isRecord(value.byProfile) ? Object.entries(value.byProfile) : [];
  const validSlices = slices.filter(([, slice]) => isRecord(slice));
  return {
    shared: toLibraryState(value.shared),
    byProfile: Object.fromEntries(validSlices.map(([id, slice]) => [id, toLibraryState(slice)])),
  };
}

/**
 * Reads v2, or migrates v1 into `shared` when v2 is absent or unreadable (v1 is never written or
 * deleted, so it is a safe fallback). Throws only if storage itself fails.
 */
async function readStoredLibrary(): Promise<StoredLibrary> {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  const value = raw === null ? null : parseJson(raw);
  if (isRecord(value)) return toStoredLibrary(value);
  const v1 = await AsyncStorage.getItem(V1_STATE_KEY);
  return { shared: v1 === null ? EMPTY : toLibraryState(parseJson(v1)), byProfile: {} };
}

function isEmptyState(state: LibraryState): boolean {
  return state.favorites.length === 0 && state.completed.length === 0 && Object.keys(state.progress).length === 0;
}

/** The active profile id, or null when no (known) profile is active, which means `shared`. */
function resolveActiveId(profiles: Profile[], activeId: string | null): string | null {
  return activeId !== null && profiles.some((p) => p.id === activeId) ? activeId : null;
}

/**
 * Drops slices of profiles that were in `previousProfiles` and are gone now (deleted in-session),
 * then lets the first profile adopt `shared` so favorites saved before profiles existed are kept.
 * Pass `previousProfiles: null` to skip pruning (first reconcile after load, or a plain mutation):
 * a slice whose profile is merely missing at load is kept, since that alone does not prove deletion.
 * Returns `library` itself when nothing changes. Must only run once saved state and profiles have loaded.
 */
function reconcile(
  library: StoredLibrary,
  profiles: Profile[],
  activeId: string | null,
  previousProfiles: Profile[] | null,
): StoredLibrary {
  const ids = new Set(profiles.map((p) => p.id));
  const deletedIds = new Set((previousProfiles ?? []).map((p) => p.id).filter((id) => !ids.has(id)));
  let next = library;
  if (Object.keys(next.byProfile).some((id) => deletedIds.has(id))) {
    next = {
      ...next,
      byProfile: Object.fromEntries(Object.entries(next.byProfile).filter(([id]) => !deletedIds.has(id))),
    };
  }
  const active = resolveActiveId(profiles, activeId);
  const canAdopt =
    active !== null && !profiles.some((p) => Object.hasOwn(next.byProfile, p.id)) && !isEmptyState(next.shared);
  if (canAdopt) next = { shared: EMPTY, byProfile: { ...next.byProfile, [active]: next.shared } };
  return next;
}

function activeSlice(library: StoredLibrary, activeId: string | null): LibraryState {
  return activeId === null ? library.shared : (library.byProfile[activeId] ?? EMPTY);
}

function updateSlice(
  library: StoredLibrary,
  activeId: string | null,
  change: (state: LibraryState) => LibraryState,
): StoredLibrary {
  if (activeId === null) return { ...library, shared: change(library.shared) };
  return { ...library, byProfile: { ...library.byProfile, [activeId]: change(activeSlice(library, activeId)) } };
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { ready: profilesReady, trusted: profilesTrusted, profiles, activeId: requestedActiveId } = useProfiles();
  const [stories, setStories] = useState<Story[]>([]);
  const [library, setLibrary] = useState<StoredLibrary>(EMPTY_LIBRARY);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  // False when reading saved state failed: we keep working in memory but never overwrite storage.
  const canPersist = useRef(false);

  const ready = stateLoaded && profilesReady;
  const activeId = resolveActiveId(profiles, requestedActiveId);

  // Mutations read the latest profile context from here so their identities stay stable across
  // profile switches (PlayerProvider re-runs effects when they change).
  // Layout effect so the ref is current before any effect or event can call a mutation.
  const current = useRef({ ready, profilesTrusted, profiles, activeId });
  useLayoutEffect(() => {
    current.current = { ready, profilesTrusted, profiles, activeId };
  }, [ready, profilesTrusted, profiles, activeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await readStoredLibrary();
        if (cancelled) return;
        setLibrary(saved);
        canPersist.current = true;
      } catch {
        // storage unavailable: start fresh in memory and leave saved data alone
      }
      if (!cancelled) setStateLoaded(true);
    })();
    loadCatalog((local) => {
      if (cancelled) return;
      setStories(local);
      setCatalogLoaded(true);
    }).then((fresh) => {
      if (!cancelled) setStories(fresh);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Adoption and pruning depend on the real profile list, so they wait until it has loaded, and are
  // skipped entirely when it could not be read (an empty list there does not mean "all deleted").
  // Done during render (not in an effect) so nothing ever renders or persists an unreconciled library.
  const [reconciledFor, setReconciledFor] = useState<{ profiles: Profile[]; activeId: string | null } | null>(
    null,
  );
  if (ready && profilesTrusted && (reconciledFor?.profiles !== profiles || reconciledFor.activeId !== activeId)) {
    const previousProfiles = reconciledFor?.profiles ?? null;
    setReconciledFor({ profiles, activeId });
    setLibrary((l) => reconcile(l, profiles, activeId, previousProfiles));
  }

  // Persist only after everything has loaded and been reconciled, so we never overwrite saved data
  // with EMPTY or with a slice layout computed against profiles that had not loaded (or failed to).
  useEffect(() => {
    if (!ready || !profilesTrusted || !canPersist.current) return;
    AsyncStorage.setItem(STATE_KEY, JSON.stringify(library)).catch(() => {});
  }, [library, ready, profilesTrusted]);

  const updateActive = useCallback((change: (state: LibraryState) => LibraryState) => {
    const { ready: isReady, profilesTrusted: trusted, profiles: list, activeId: id } = current.current;
    // Before load, a change would be replaced by (or would clobber) the saved state, so drop it.
    if (!isReady) return;
    setLibrary((l) => updateSlice(trusted ? reconcile(l, list, id, null) : l, id, change));
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      updateActive((s) => ({
        ...s,
        favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
      }));
    },
    [updateActive],
  );

  const saveProgress = useCallback(
    (id: string, seconds: number) => {
      updateActive((s) => ({ ...s, progress: { ...s.progress, [id]: Math.max(0, seconds) } }));
    },
    [updateActive],
  );

  const markCompleted = useCallback(
    (id: string) => {
      updateActive((s) => ({
        ...s,
        completed: s.completed.includes(id) ? s.completed : [...s.completed, id],
        progress: { ...s.progress, [id]: 0 },
      }));
    },
    [updateActive],
  );

  const state = activeSlice(library, activeId);

  const value = useMemo<LibraryContextValue>(
    () => ({
      stories,
      ready,
      loading: !ready || !catalogLoaded,
      favorites: state.favorites,
      progress: state.progress,
      completed: state.completed,
      isFavorite: (id) => state.favorites.includes(id),
      toggleFavorite,
      getProgress: (id) => state.progress[id] ?? 0,
      saveProgress,
      markCompleted,
      isCompleted: (id) => state.completed.includes(id),
      getStory: (id) => stories.find((s) => s.id === id),
    }),
    [stories, ready, catalogLoaded, state, toggleFavorite, saveProgress, markCompleted],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
