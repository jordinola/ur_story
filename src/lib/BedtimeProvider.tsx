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
import { AppState } from 'react-native';
import { BEDTIME_KEY, endsAtFor, isExpired, parseStoredSession, remainingSec, serializeSession } from './bedtime';
import { FADE_MS } from './fade';
import { usePlayer } from './PlayerProvider';

type BedtimeContextValue = {
  /** True once the saved session has been read (or the read failed). */
  ready: boolean;
  /** A session is running or waiting behind the lock. */
  active: boolean;
  locked: boolean;
  remainingSec: number | null;
  startBedtime: (minutes: number) => void;
  /** Ends the session and lifts the lock. */
  endBedtime: () => void;
};

const BedtimeContext = createContext<BedtimeContextValue | null>(null);

const TICK_MS = 1000;

export function BedtimeProvider({ children }: { children: ReactNode }) {
  const { isPlaying, pause, fadeOutAndPause } = usePlayer();
  const [ready, setReady] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // A start or end before the saved session has loaded wins over what was saved.
  const changedBeforeLoad = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(BEDTIME_KEY)
      .then((raw) => {
        const saved = parseStoredSession(raw);
        if (cancelled || changedBeforeLoad.current || saved == null) return;
        const current = Date.now();
        setEndsAt(saved);
        setNow(current);
        setLocked(isExpired(saved, current));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fade near the end, lock at the end, and tick the countdown. Timers can be suspended in the
  // background, so the app state listener below re-checks when the app comes back.
  useEffect(() => {
    if (endsAt == null || locked) return;
    const current = Date.now();
    const fadeTimer = setTimeout(() => fadeOutAndPause(endsAt), Math.max(0, endsAt - FADE_MS - current));
    const lockTimer = setTimeout(() => setLocked(true), Math.max(0, endsAt - current));
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(lockTimer);
      clearInterval(tick);
    };
  }, [endsAt, locked, fadeOutAndPause]);

  useEffect(() => {
    if (endsAt == null) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const current = Date.now();
      setNow(current);
      if (isExpired(endsAt, current)) setLocked(true);
    });
    return () => subscription.remove();
  }, [endsAt]);

  // Control Center and the lock screen can still press play; keep the story paused while locked.
  useEffect(() => {
    if (locked && isPlaying) pause();
  }, [locked, isPlaying, pause]);

  const startBedtime = useCallback((minutes: number) => {
    changedBeforeLoad.current = true;
    const current = Date.now();
    const end = endsAtFor(minutes, current);
    setLocked(false);
    setEndsAt(end);
    setNow(current);
    AsyncStorage.setItem(BEDTIME_KEY, serializeSession(end)).catch(() => {});
  }, []);

  const endBedtime = useCallback(() => {
    changedBeforeLoad.current = true;
    setLocked(false);
    setEndsAt(null);
    AsyncStorage.removeItem(BEDTIME_KEY).catch(() => {});
  }, []);

  const value = useMemo<BedtimeContextValue>(
    () => ({
      ready,
      active: endsAt != null,
      locked,
      remainingSec: endsAt == null ? null : remainingSec(endsAt, now),
      startBedtime,
      endBedtime,
    }),
    [ready, endsAt, locked, now, startBedtime, endBedtime],
  );

  return <BedtimeContext.Provider value={value}>{children}</BedtimeContext.Provider>;
}

export function useBedtime(): BedtimeContextValue {
  const ctx = useContext(BedtimeContext);
  if (!ctx) throw new Error('useBedtime must be used inside BedtimeProvider');
  return ctx;
}
