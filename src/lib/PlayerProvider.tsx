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
import { FADE_MS } from './fade';
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
  /** False only when loading the story failed (`error` is set); a resume of the current story is true. */
  play: (story: Story, options?: { fromStart?: boolean }) => boolean;
  /** Restarts the current story from 0, also after it finished. Does nothing when no story is current. */
  replay: () => void;
  toggle: () => void;
  /** Pauses unconditionally, unlike `toggle`, which flips whatever the native player is doing right now. */
  pause: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  /** Minutes the timer was set to, or null when off. */
  sleepMinutes: number | null;
  sleepRemainingSec: number | null;
  setSleepTimer: (minutes: number | null) => void;
  /** Fades the volume over the last seconds before `endsAt` (epoch ms), then pauses. Replaces any sleep timer. */
  fadeOutAndPause: (endsAt: number) => void;
  /** Bumped once per natural story finish, so a queue can react to each one. */
  finishCount: number;
  /** Bumped when a sleep timer or bedtime fade runs out, so a queue can stop instead of advancing. */
  sleepExpiredCount: number;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const PROGRESS_SAVE_INTERVAL_MS = 5000;
const SLEEP_TICK_MS = 1000;
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
  const [finishCount, setFinishCount] = useState(0);
  const [sleepExpiredCount, setSleepExpiredCount] = useState(0);

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
    (story: Story, options?: { fromStart?: boolean }) => {
      if (currentRef.current?.id === story.id) {
        if (!player.playing) player.play();
        return true;
      }
      setError(null);
      // Sync ref so a same-story play() before the commit (e.g. a setParams render) is a resume.
      currentRef.current = story;
      setCurrent(story);
      setRate(DEFAULT_RATE);
      restoreVolume();
      try {
        player.setPlaybackRate(DEFAULT_RATE);
        const saved = getProgress(story.id);
        // fromStart is for an explicit pick (e.g. repeat-all wrapping), which must not resume mid-story.
        pendingSeek.current = !options?.fromStart && saved > 3 ? saved : null;
        player.replace({ uri: resolveUrl(story.audio) });
        player.setActiveForLockScreen(true, {
          title: story.title,
          artist: 'UR Story',
          albumTitle: 'Bedtime stories',
        });
        player.play();
        return true;
      } catch {
        setError('Could not load this story. Check your connection and the audio URL.');
        return false;
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
    if (!status.didJustFinish || !currentRef.current) return;
    markCompleted(currentRef.current.id);
    setFinishCount((n) => n + 1);
  }, [status.didJustFinish, markCompleted]);

  // Sleep timer.
  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepMinutes(minutes);
    setSleepEndsAt(minutes ? Date.now() + minutes * 60_000 : null);
    setSleepRemainingSec(minutes ? minutes * 60 : null);
  }, []);

  // Reuses the sleep timer's fade effect below, so a bedtime session ends exactly like a sleep timer does.
  const fadeOutAndPause = useCallback((endsAt: number) => {
    setSleepMinutes(null);
    setSleepEndsAt(endsAt);
    setSleepRemainingSec(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
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
        setSleepExpiredCount((n) => n + 1);
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

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const seekTo = useCallback(
    (seconds: number) => {
      player.seekTo(Math.max(0, seconds)).catch(() => {});
    },
    [player],
  );

  // A finished player is not playing, so play() on the same id would only call player.play(), which
  // can sit at the end. Seek first, then play. Nothing is marked completed here: that fires off the
  // finish status change, and the periodic save skips a finished position.
  const replay = useCallback(() => {
    if (!currentRef.current) return;
    pendingSeek.current = null; // a resume seek still waiting for the load must not override restarting from 0
    seekTo(0);
    player.play();
  }, [player, seekTo]);

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
      replay,
      toggle,
      pause,
      seekBy,
      seekTo,
      sleepMinutes,
      sleepRemainingSec,
      setSleepTimer,
      fadeOutAndPause,
      finishCount,
      sleepExpiredCount,
      playbackRate,
      setPlaybackRate,
    }),
    [current, status, error, play, replay, toggle, pause, seekBy, seekTo, sleepMinutes, sleepRemainingSec, setSleepTimer, fadeOutAndPause, finishCount, sleepExpiredCount, playbackRate, setPlaybackRate],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
