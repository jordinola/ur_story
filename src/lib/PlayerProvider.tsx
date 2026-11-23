import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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
import { resolveUrl } from './catalog';
import { useLibrary } from './LibraryProvider';
import { useProfiles } from './ProfilesProvider';
import type { Story } from '../types';

type PlayerContextValue = {
  current: Story | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  error: string | null;
  play: (story: Story) => void;
  toggle: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  /** Minutes the timer was set to, or null when off. */
  sleepMinutes: number | null;
  sleepRemainingSec: number | null;
  setSleepTimer: (minutes: number | null) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const PROGRESS_SAVE_INTERVAL_MS = 5000;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { saveProgress, markCompleted, getProgress } = useLibrary();
  const { activeId } = useProfiles();
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const [current, setCurrent] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);

  const pendingSeek = useRef<number | null>(null);
  const currentRef = useRef<Story | null>(null);
  const positionRef = useRef(0);

  // Keep refs in sync after commit (not during render). Declared first, and a layout effect, so the
  // effects below (including the profile-switch layout effect) always read fresh values.
  useLayoutEffect(() => {
    currentRef.current = current;
    positionRef.current = status.currentTime;
  });

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Required for lock-screen / Control Center controls.
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  const play = useCallback(
    (story: Story) => {
      if (currentRef.current?.id === story.id) {
        if (!player.playing) player.play();
        return;
      }
      setError(null);
      setCurrent(story);
      try {
        const saved = getProgress(story.id);
        pendingSeek.current = saved > 3 ? saved : null;
        player.replace({ uri: resolveUrl(story.audio) });
        player.setActiveForLockScreen(true, {
          title: story.title,
          artist: 'UR Story',
          albumTitle: 'Bedtime stories',
        });
        player.play();
      } catch {
        setError('Could not load this story. Check your connection and the audio URL.');
      }
    },
    [player, getProgress],
  );

  // Resume from the saved position once the new source has loaded.
  useEffect(() => {
    if (status.isLoaded && pendingSeek.current != null) {
      const target = pendingSeek.current;
      pendingSeek.current = null;
      player.seekTo(target).catch(() => {});
    }
  }, [status.isLoaded, player]);

  // Library writes go to the active profile, so a story started by one kid must never save into
  // another's. On a switch, stop and forget the story before any later tick, pause or finish fires,
  // and drop the lock-screen session so it cannot restart the previous kid's story out of the app.
  // Layout effect so nothing can run between the commit of the new profile and this cleanup.
  const playingFor = useRef(activeId);
  useLayoutEffect(() => {
    if (playingFor.current === activeId) return;
    playingFor.current = activeId;
    currentRef.current = null;
    pendingSeek.current = null;
    setCurrent(null);
    player.pause();
    player.clearLockScreenControls();
  }, [activeId, player]);

  // Save progress periodically while playing, and when pausing.
  useEffect(() => {
    if (!status.playing) {
      const c = currentRef.current;
      if (c && positionRef.current > 0 && !status.didJustFinish) saveProgress(c.id, positionRef.current);
      return;
    }
    const id = setInterval(() => {
      const c = currentRef.current;
      if (c) saveProgress(c.id, positionRef.current);
    }, PROGRESS_SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status.playing, status.didJustFinish, saveProgress]);

  useEffect(() => {
    if (status.didJustFinish && currentRef.current) markCompleted(currentRef.current.id);
  }, [status.didJustFinish, markCompleted]);

  // Sleep timer.
  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepMinutes(minutes);
    setSleepEndsAt(minutes ? Date.now() + minutes * 60_000 : null);
    setSleepRemainingSec(minutes ? minutes * 60 : null);
  }, []);

  useEffect(() => {
    if (sleepEndsAt == null) return;
    const id = setInterval(() => {
      const remaining = Math.round((sleepEndsAt - Date.now()) / 1000);
      if (remaining <= 0) {
        player.pause();
        setSleepMinutes(null);
        setSleepEndsAt(null);
        setSleepRemainingSec(null);
      } else {
        setSleepRemainingSec(remaining);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt, player]);

  const toggle = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const seekTo = useCallback(
    (seconds: number) => {
      player.seekTo(Math.max(0, seconds)).catch(() => {});
    },
    [player],
  );

  const seekBy = useCallback(
    (delta: number) => {
      const total = status.duration || Infinity;
      seekTo(Math.min(total, positionRef.current + delta));
    },
    [seekTo, status.duration],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      isPlaying: status.playing,
      isLoading: current != null && (!status.isLoaded || status.isBuffering),
      position: status.currentTime,
      duration: status.duration || current?.durationSec || 0,
      error,
      play,
      toggle,
      seekBy,
      seekTo,
      sleepMinutes,
      sleepRemainingSec,
      setSleepTimer,
    }),
    [current, status, error, play, toggle, seekBy, seekTo, sleepMinutes, sleepRemainingSec, setSleepTimer],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
