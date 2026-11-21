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
import { loadCatalog } from './catalog';
import type { LibraryState, Story } from '../types';

const STATE_KEY = 'storytime:library:v1';
const EMPTY: LibraryState = { favorites: [], progress: {}, completed: [] };

type LibraryContextValue = {
  stories: Story[];
  ready: boolean;
  /** True until saved state and the first catalog (cached or bundled) have both loaded. */
  loading: boolean;
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  getProgress: (id: string) => number;
  saveProgress: (id: string, seconds: number) => void;
  markCompleted: (id: string) => void;
  isCompleted: (id: string) => boolean;
  getStory: (id: string) => Story | undefined;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [state, setState] = useState<LibraryState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        if (raw && !cancelled) setState({ ...EMPTY, ...(JSON.parse(raw) as Partial<LibraryState>) });
      } catch {
        // start fresh
      }
      loaded.current = true;
      if (!cancelled) setReady(true);
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

  // Persist after the initial load so we never overwrite saved data with EMPTY.
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const toggleFavorite = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
    }));
  }, []);

  const saveProgress = useCallback((id: string, seconds: number) => {
    setState((s) => ({ ...s, progress: { ...s.progress, [id]: Math.max(0, seconds) } }));
  }, []);

  const markCompleted = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      completed: s.completed.includes(id) ? s.completed : [...s.completed, id],
      progress: { ...s.progress, [id]: 0 },
    }));
  }, []);

  const value = useMemo<LibraryContextValue>(
    () => ({
      stories,
      ready,
      loading: !ready || !catalogLoaded,
      favorites: state.favorites,
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
