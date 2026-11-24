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
import { DEFAULT_RATE } from './playbackRates';
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
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const PROGRESS_SAVE_INTERVAL_MS = 5000;
const SLEEP_TICK_MS = 1000;
const FADE_MS = 10_000;
const FADE_TICK_MS = 250;

// expo-audio exposes volume as a plain property; keep the assignment out of the component body.
const setVolume = (player: { volume: number }, volume: number) => {
  player.volume = volume;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { saveProgress, markCompleted, getProgress } = useLibrary();
  const { activeId } = useProfiles();
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const [current, setCurrent] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackRate, setRate] = useState<number>(DEFAULT_RATE);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);

  const pendingSeek = useRef<number | null>(null);
  const currentRef = useRef<Story | null>(null);
  const positionRef = useRef(0);
  const playingRef = useRef(false);

  // Keep refs in sync after commit (not during render). Declared first, and a layout effect, so the
  // effects below (including the profile-switch layout effect) always read fresh values.
  useLayoutEffect(() => {
    currentRef.current = current;
    positionRef.current = status.currentTime;
    playingRef.current = status.playing;
  });

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Required for lock-screen / Control Center controls.
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  const restoreVolume = useCallback(() => {
    try {
      setVolume(player, 1);
    } catch {
      // the native player may already be released during unmount
    }
  }, [player]);

  const play = useCallback(
    (story: Story) => {
      if (currentRef.current?.id === story.id) {
        if (!player.playing) player.play();
        return;
      }
      setError(null);
      setCurrent(story);
      setRate(DEFAULT_RATE);
      restoreVolume();
      try {
        player.setPlaybackRate(DEFAULT_RATE);
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
    [player, getProgress, restoreVolume],
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
    setSleepMinutes(null);
    setSleepEndsAt(null);
    setSleepRemainingSec(null);
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

  // Fade the volume out over the last FADE_MS, then pause. The cleanup restores full volume on every
  // way out: timer cleared or replaced, profile switch, unmount, and the natural end.
  useEffect(() => {
    if (sleepEndsAt == null) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = sleepEndsAt - Date.now() <= FADE_MS ? FADE_TICK_MS : SLEEP_TICK_MS;
      timer = setTimeout(tick, delay);
    };
    const tick = () => {
      const remainingMs = sleepEndsAt - Date.now();
      if (remainingMs <= 0) {
        player.pause();
        setSleepMinutes(null);
        setSleepEndsAt(null);
        setSleepRemainingSec(null);
        return;
      }
      setSleepRemainingSec(Math.round(remainingMs / 1000));
      if (remainingMs <= FADE_MS && playingRef.current) setVolume(player, remainingMs / FADE_MS);
      schedule();
    };
    schedule();
    return () => {
      clearTimeout(timer);
      restoreVolume();
    };
  }, [sleepEndsAt, player, restoreVolume]);

  // Paused mid-fade (in the app, on the lock screen, or by an interruption): don't leave it quiet.
  useEffect(() => {
    if (!status.playing) restoreVolume();
  }, [status.playing, restoreVolume]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      setRate(rate);
      player.setPlaybackRate(rate);
    },
    [player],
  );

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
      playbackRate,
      setPlaybackRate,
    }),
    [current, status, error, play, toggle, seekBy, seekTo, sleepMinutes, sleepRemainingSec, setSleepTimer, playbackRate, setPlaybackRate],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
