import { router, usePathname } from 'expo-router';
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
import { AppState } from 'react-native';
import { useBedtime } from './BedtimeProvider';
import { usePlayer } from './PlayerProvider';
import { useProfiles } from './ProfilesProvider';
import {
  enqueue as enqueueStory,
  moveToTop as moveStoryToTop,
  playNext as playStoryNext,
  removeFromQueue,
  shiftQueue,
} from './queue';
import type { Story } from '../types';

/** Seconds the "Up next" banner counts down before the next queued story starts. */
export const GAP_SEC = 5;

type QueueContextValue = {
  queue: Story[];
  /** The story that starts when the gap ends; null when no gap is counting. */
  upNext: Story | null;
  /** Counts GAP_SEC down to 1 while the gap runs, then becomes null (also null when no gap is counting). */
  gapRemainingSec: number | null;
  enqueue: (story: Story) => void;
  playNext: (story: Story) => void;
  moveToTop: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Stops the countdown; the queue is kept and nothing starts. */
  cancelUpNext: () => void;
  /** Cancels any gap and starts the head of the queue now; does nothing on an empty queue. */
  playNextNow: () => void;
  /** Cancels any gap and starts the queued story with this id now; the others stay queued. Unknown id does nothing. */
  playNow: (id: string) => void;
};

const QueueContext = createContext<QueueContextValue | null>(null);

const TICK_MS = 1000;

export function QueueProvider({ children }: { children: ReactNode }) {
  const { current, isPlaying, play, finishCount, sleepExpiredCount } = usePlayer();
  const { locked } = useBedtime();
  const { activeId } = useProfiles();
  const pathname = usePathname();

  const [queue, setQueue] = useState<Story[]>([]);
  const [gapRemainingSec, setGapRemainingSec] = useState<number | null>(null);

  // The queue ref is the source of truth so several edits in one tick compose; state mirrors it.
  const queueRef = useRef<Story[]>([]);
  const gapTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredAtFinish = useRef(sleepExpiredCount);
  const seenFinishCount = useRef(finishCount);
  const seenSleepExpiredCount = useRef(sleepExpiredCount);
  const currentRef = useRef(current);
  const lockedRef = useRef(locked);
  const sleepExpiredRef = useRef(sleepExpiredCount);
  const playRef = useRef(play);
  const pathnameRef = useRef(pathname);

  // Declared first, and a layout effect, so the effects below always read fresh values.
  useLayoutEffect(() => {
    currentRef.current = current;
    lockedRef.current = locked;
    sleepExpiredRef.current = sleepExpiredCount;
    playRef.current = play;
    pathnameRef.current = pathname;
  });

  const stopGapTimer = useCallback(() => {
    if (gapTimer.current == null) return;
    clearInterval(gapTimer.current);
    gapTimer.current = null;
  }, []);

  const cancelUpNext = useCallback(() => {
    if (gapTimer.current == null) return;
    stopGapTimer();
    setGapRemainingSec(null);
  }, [stopGapTimer]);

  const commitQueue = useCallback(
    (next: Story[]) => {
      queueRef.current = next;
      setQueue(next);
      if (next.length === 0) cancelUpNext();
    },
    [cancelUpNext],
  );

  const dropQueued = useCallback(
    (id: string) => {
      if (queueRef.current.some((story) => story.id === id)) commitQueue(removeFromQueue(queueRef.current, id));
    },
    [commitQueue],
  );

  const followOnStoryScreen = useCallback((story: Story) => {
    if (pathnameRef.current.startsWith('/story/')) router.setParams({ id: story.id });
  }, []);

  // Starts the head of the queue. A story that fails to load is dropped and the next one is tried.
  const advance = useCallback(() => {
    let rest = queueRef.current;
    let started: Story | null = null;
    while (started == null && rest.length > 0) {
      const shifted = shiftQueue(rest);
      rest = shifted.rest;
      if (shifted.next && playRef.current(shifted.next) !== false) started = shifted.next;
    }
    commitQueue(rest);
    if (started) followOnStoryScreen(started);
  }, [commitQueue, followOnStoryScreen]);

  // End conditions are checked again here: a bedtime lock or a sleep expiry since the finish wins.
  const endGap = useCallback(() => {
    cancelUpNext();
    if (lockedRef.current || sleepExpiredRef.current !== expiredAtFinish.current) return;
    advance();
  }, [cancelUpNext, advance]);

  // An explicit Next tap: no sleep-expiry or bedtime baseline check, unlike the gap ending by itself.
  const playNextNow = useCallback(() => {
    cancelUpNext();
    advance();
  }, [cancelUpNext, advance]);

  // An explicit tap on a queued story: the stories above it stay queued, and a failed start is not retried.
  const playNow = useCallback(
    (id: string) => {
      const story = queueRef.current.find((queued) => queued.id === id);
      if (!story) return;
      cancelUpNext();
      commitQueue(removeFromQueue(queueRef.current, id));
      if (playRef.current(story) !== false) followOnStoryScreen(story);
    },
    [cancelUpNext, commitQueue, followOnStoryScreen],
  );

  const startGap = useCallback(() => {
    stopGapTimer();
    let remaining = GAP_SEC;
    setGapRemainingSec(remaining);
    gapTimer.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) setGapRemainingSec(remaining);
      else endGap();
    }, TICK_MS);
  }, [stopGapTimer, endGap]);

  // A story started by hand leaves the queue and cancels the gap. Runs before the finish handler so
  // a story that starts and finishes within one render is dropped rather than cancelling its own gap.
  useEffect(() => {
    if (!current) return;
    cancelUpNext();
    dropQueued(current.id);
  }, [current, cancelUpNext, dropQueued]);

  // Finish and sleep-expiry signals are handled together so a finish in the same render as an
  // expiry is seen as "time ran out", not as a story ending.
  useEffect(() => {
    const finished = finishCount !== seenFinishCount.current;
    const expired = sleepExpiredCount !== seenSleepExpiredCount.current;
    seenFinishCount.current = finishCount;
    seenSleepExpiredCount.current = sleepExpiredCount;
    if (expired) cancelUpNext();
    if (!finished) return;

    // Never replay the story that just ended through the player's same-id resume.
    const finishedStory = currentRef.current;
    if (finishedStory) commitQueue(removeFromQueue(queueRef.current, finishedStory.id));

    if (expired || gapTimer.current != null) return;
    if (queueRef.current.length === 0 || lockedRef.current) return;
    expiredAtFinish.current = sleepExpiredCount;
    // JS timers may be suspended while nothing plays in the background, so skip the gap there.
    if (AppState.currentState !== 'active') advance();
    else startGap();
  }, [finishCount, sleepExpiredCount, cancelUpNext, commitQueue, advance, startGap]);

  // The screen can lock or the app can leave mid-gap; start now rather than stall on suspended timers.
  // Only 'background': 'inactive' also fires for Control Center and the app switcher.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && gapTimer.current != null) endGap();
    });
    return () => subscription.remove();
  }, [endGap]);

  // Any resume (player, lock screen, Control Center) cancels the gap.
  useEffect(() => {
    if (isPlaying) cancelUpNext();
  }, [isPlaying, cancelUpNext]);

  // The queue belongs to one profile.
  // Layout effect, like PlayerProvider's profile switch: nothing may run between the new profile's
  // commit and this cleanup (a gap tick could otherwise start the old queue for the new profile).
  const queueFor = useRef(activeId);
  useLayoutEffect(() => {
    if (queueFor.current === activeId) return;
    queueFor.current = activeId;
    cancelUpNext();
    commitQueue([]);
  }, [activeId, cancelUpNext, commitQueue]);

  useEffect(() => stopGapTimer, [stopGapTimer]);

  const enqueue = useCallback(
    (story: Story) => {
      if (currentRef.current?.id === story.id) return;
      commitQueue(enqueueStory(queueRef.current, story));
    },
    [commitQueue],
  );

  const playNext = useCallback(
    (story: Story) => {
      if (currentRef.current?.id === story.id) return;
      commitQueue(playStoryNext(queueRef.current, story));
    },
    [commitQueue],
  );

  const moveToTop = useCallback((id: string) => commitQueue(moveStoryToTop(queueRef.current, id)), [commitQueue]);
  const remove = useCallback((id: string) => commitQueue(removeFromQueue(queueRef.current, id)), [commitQueue]);
  const clear = useCallback(() => commitQueue([]), [commitQueue]);

  const value = useMemo<QueueContextValue>(
    () => ({
      queue,
      upNext: gapRemainingSec == null ? null : (queue[0] ?? null),
      gapRemainingSec,
      enqueue,
      playNext,
      moveToTop,
      remove,
      clear,
      cancelUpNext,
      playNextNow,
      playNow,
    }),
    [queue, gapRemainingSec, enqueue, playNext, moveToTop, remove, clear, cancelUpNext, playNextNow, playNow],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used inside QueueProvider');
  return ctx;
}
