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
import {
  afterFinish,
  canNext as playlistCanNext,
  emptyPlaylist,
  next as nextAfter,
  previous,
  recordPlayed,
  setRepeat as withRepeat,
  setShuffle as withShuffle,
  type NextResult,
  type PlaylistState,
  type RepeatMode,
} from './playlist';
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
  /** Stories played this session for this profile, most recent last. */
  history: Story[];
  shuffle: boolean;
  repeat: RepeatMode;
  /** True when Next has something to start: a queued story, or the Repeat all loop. */
  canNext: boolean;
  /** The story that starts when the gap ends; null when no gap is counting. */
  upNext: Story | null;
  /** Counts GAP_SEC down to 1 while the gap runs, then becomes null (also null when no gap is counting). */
  gapRemainingSec: number | null;
  enqueue: (story: Story) => void;
  playNext: (story: Story) => void;
  moveToTop: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Turning Shuffle on shuffles the queue once; turning it off keeps the current order. */
  setShuffle: (on: boolean) => void;
  setRepeat: (mode: RepeatMode) => void;
  /** Stops the countdown; the queue is kept and nothing starts. */
  cancelUpNext: () => void;
  /**
   * Cancels any gap and starts the head of the queue now, ignoring Repeat one. With an empty queue it
   * starts the Repeat all loop, and otherwise does nothing.
   */
  playNextNow: () => void;
  /** Cancels any gap and starts the queued story with this id now; the others stay queued. Unknown id does nothing. */
  playNow: (id: string) => void;
  /** Restarts the current story, or goes back to the last played one (see `previous` in playlist.ts). */
  playPrevious: () => void;
};

const QueueContext = createContext<QueueContextValue | null>(null);

const TICK_MS = 1000;

export function QueueProvider({ children }: { children: ReactNode }) {
  const { current, isPlaying, position, play, replay, seekTo, finishCount, sleepExpiredCount } = usePlayer();
  const { locked } = useBedtime();
  const { activeId } = useProfiles();
  const pathname = usePathname();

  const [playlist, setPlaylist] = useState<PlaylistState>(emptyPlaylist);
  const [gapRemainingSec, setGapRemainingSec] = useState<number | null>(null);

  // The playlist ref is the source of truth so several edits in one tick compose; state mirrors it.
  const playlistRef = useRef<PlaylistState>(emptyPlaylist);
  const gapTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiredAtFinish = useRef(sleepExpiredCount);
  const seenFinishCount = useRef(finishCount);
  const seenSleepExpiredCount = useRef(sleepExpiredCount);
  // The last story the current effect saw, so a change can record it into history.
  const shownStory = useRef<Story | null>(null);
  // The story Previous went back to: its arrival must not push the story we left into history.
  const wentBackTo = useRef<string | null>(null);
  // The story that ended when the Repeat all loop restarted: the loop already placed it, skip recording it.
  const loopFinished = useRef<string | null>(null);
  // Stories queued by a loop restart start from the beginning, not from a saved position.
  const loopIds = useRef(new Set<string>());
  const currentRef = useRef(current);
  const positionRef = useRef(position);
  const lockedRef = useRef(locked);
  const sleepExpiredRef = useRef(sleepExpiredCount);
  const playRef = useRef(play);
  const replayRef = useRef(replay);
  const seekToRef = useRef(seekTo);
  const pathnameRef = useRef(pathname);

  // Declared first, and a layout effect, so the effects below always read fresh values.
  useLayoutEffect(() => {
    currentRef.current = current;
    positionRef.current = position;
    lockedRef.current = locked;
    sleepExpiredRef.current = sleepExpiredCount;
    playRef.current = play;
    replayRef.current = replay;
    seekToRef.current = seekTo;
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

  const commit = useCallback(
    (next: PlaylistState) => {
      playlistRef.current = next;
      setPlaylist(next);
      if (next.queue.length === 0) {
        cancelUpNext();
        loopIds.current.clear();
      }
    },
    [cancelUpNext],
  );

  const commitQueue = useCallback(
    (queue: Story[]) => commit({ ...playlistRef.current, queue }),
    [commit],
  );

  const dropQueued = useCallback(
    (id: string) => {
      const { queue } = playlistRef.current;
      if (queue.some((story) => story.id === id)) commitQueue(removeFromQueue(queue, id));
    },
    [commitQueue],
  );

  const followOnStoryScreen = useCallback((story: Story) => {
    if (pathnameRef.current.startsWith('/story/')) router.setParams({ id: story.id });
  }, []);

  const startStory = useCallback((story: Story) => {
    const started = loopIds.current.delete(story.id)
      ? playRef.current(story, { fromStart: true })
      : playRef.current(story);
    return started !== false;
  }, []);

  // Starts the head of the queue. A story that fails to load is dropped and the next one is tried.
  const advance = useCallback(() => {
    let rest = playlistRef.current.queue;
    let started: Story | null = null;
    while (started == null && rest.length > 0) {
      const shifted = shiftQueue(rest);
      rest = shifted.rest;
      if (shifted.next && startStory(shifted.next)) started = shifted.next;
    }
    commitQueue(rest);
    if (started) followOnStoryScreen(started);
    else loopFinished.current = null;
  }, [commitQueue, startStory, followOnStoryScreen]);

  // Puts the planned story at the head of the queue so the gap (and upNext) and `advance` see it.
  // A loop restart replaces the queue and clears history; the queue-head case leaves it as it is.
  const planNext = useCallback(
    (result: Extract<NextResult, { type: 'play' }>, finished: Story) => {
      if (playlistRef.current.queue.length > 0) return;
      loopFinished.current = finished.id;
      const queue = [result.story, ...result.state.queue];
      commit({ ...result.state, queue });
      loopIds.current = new Set(queue.map((story) => story.id));
    },
    [commit],
  );

  // Decides what follows a finish. Returns true when a next story waits at the head of the queue
  // for the gap (or an immediate advance); a replay starts here, as it needs no countdown or timer.
  const planAfterFinish = useCallback(
    (finished: Story | null) => {
      if (!finished) return playlistRef.current.queue.length > 0;
      const result = afterFinish(playlistRef.current, finished);
      if (result.type === 'stop') return false;
      if (result.type === 'replay') {
        replayRef.current();
        return false;
      }
      planNext(result, finished);
      return true;
    },
    [planNext],
  );

  // End conditions are checked again here: a bedtime lock or a sleep expiry since the finish wins.
  const endGap = useCallback(() => {
    cancelUpNext();
    if (lockedRef.current || sleepExpiredRef.current !== expiredAtFinish.current) return;
    advance();
  }, [cancelUpNext, advance]);

  // An explicit Next tap: no sleep-expiry or bedtime baseline check, unlike the gap ending by itself.
  const playNextNow = useCallback(() => {
    cancelUpNext();
    const finished = currentRef.current;
    if (finished && playlistRef.current.queue.length === 0) {
      const result = nextAfter(playlistRef.current, finished);
      if (result.type === 'stop') return;
      if (result.type === 'replay') {
        replayRef.current();
        return;
      }
      planNext(result, finished);
    }
    advance();
  }, [cancelUpNext, planNext, advance]);

  // An explicit tap on a queued story: the stories above it stay queued, and a failed start is not retried.
  const playNow = useCallback(
    (id: string) => {
      const story = playlistRef.current.queue.find((queued) => queued.id === id);
      if (!story) return;
      cancelUpNext();
      commitQueue(removeFromQueue(playlistRef.current.queue, id));
      if (startStory(story)) followOnStoryScreen(story);
    },
    [cancelUpNext, commitQueue, startStory, followOnStoryScreen],
  );

  const playPrevious = useCallback(() => {
    const story = currentRef.current;
    if (!story) return;
    cancelUpNext();
    const before = playlistRef.current;
    const result = previous(before, story, positionRef.current);
    if (result.action === 'restart') {
      seekToRef.current(0);
      return;
    }
    wentBackTo.current = result.story.id;
    if (playRef.current(result.story, { fromStart: true }) === false) {
      // The story failed to load: drop it from history. The player now shows the load error (its current is
      // the failed story), and the screen stays on the story it was on because the route param is not updated.
      wentBackTo.current = null;
      commit({ ...before, history: before.history.slice(0, -1) });
      return;
    }
    commit(result.state);
    followOnStoryScreen(result.story);
  }, [cancelUpNext, commit, followOnStoryScreen]);

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

  // A story started by hand leaves the queue and cancels the gap, and the story it replaced goes into
  // history. Runs before the finish handler so a story that starts and finishes within one render is
  // dropped rather than cancelling its own gap.
  useEffect(() => {
    if (!current) return;
    cancelUpNext();
    dropQueued(current.id);
    const left = shownStory.current;
    shownStory.current = current;
    if (!left || left.id === current.id) return;
    const skip = wentBackTo.current === current.id || loopFinished.current === left.id;
    wentBackTo.current = null;
    loopFinished.current = null;
    if (!skip) commit(recordPlayed(playlistRef.current, left));
  }, [current, cancelUpNext, dropQueued, commit]);

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
    if (finishedStory) commitQueue(removeFromQueue(playlistRef.current.queue, finishedStory.id));

    // One next story per finish: a gap already counting owns it.
    if (expired || gapTimer.current != null || lockedRef.current) return;
    if (!planAfterFinish(finishedStory)) return;
    expiredAtFinish.current = sleepExpiredCount;
    // JS timers may be suspended while nothing plays in the background, so skip the gap there.
    if (AppState.currentState !== 'active') advance();
    // The finish is an external player event and the gap is a timer, so the countdown starts here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else startGap();
  }, [finishCount, sleepExpiredCount, cancelUpNext, commitQueue, planAfterFinish, advance, startGap]);

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

  // The queue, history, Shuffle and Repeat belong to one profile.
  // Layout effect, like PlayerProvider's profile switch: nothing may run between the new profile's
  // commit and this cleanup (a gap tick could otherwise start the old queue for the new profile).
  const queueFor = useRef(activeId);
  useLayoutEffect(() => {
    if (queueFor.current === activeId) return;
    queueFor.current = activeId;
    cancelUpNext();
    shownStory.current = null;
    wentBackTo.current = null;
    loopFinished.current = null;
    commit(emptyPlaylist);
  }, [activeId, cancelUpNext, commit]);

  useEffect(() => stopGapTimer, [stopGapTimer]);

  const enqueue = useCallback(
    (story: Story) => {
      if (currentRef.current?.id === story.id) return;
      commitQueue(enqueueStory(playlistRef.current.queue, story));
    },
    [commitQueue],
  );

  const playNext = useCallback(
    (story: Story) => {
      if (currentRef.current?.id === story.id) return;
      commitQueue(playStoryNext(playlistRef.current.queue, story));
    },
    [commitQueue],
  );

  const moveToTop = useCallback(
    (id: string) => commitQueue(moveStoryToTop(playlistRef.current.queue, id)),
    [commitQueue],
  );
  const remove = useCallback(
    (id: string) => commitQueue(removeFromQueue(playlistRef.current.queue, id)),
    [commitQueue],
  );
  const clear = useCallback(() => commitQueue([]), [commitQueue]);
  const setShuffle = useCallback((on: boolean) => commit(withShuffle(playlistRef.current, on)), [commit]);
  const setRepeat = useCallback((mode: RepeatMode) => commit(withRepeat(playlistRef.current, mode)), [commit]);

  const value = useMemo<QueueContextValue>(
    () => ({
      queue: playlist.queue,
      history: playlist.history,
      shuffle: playlist.shuffle,
      repeat: playlist.repeat,
      canNext: playlistCanNext(playlist),
      upNext: gapRemainingSec == null ? null : (playlist.queue[0] ?? null),
      gapRemainingSec,
      enqueue,
      playNext,
      moveToTop,
      remove,
      clear,
      setShuffle,
      setRepeat,
      cancelUpNext,
      playNextNow,
      playNow,
      playPrevious,
    }),
    [
      playlist,
      gapRemainingSec,
      enqueue,
      playNext,
      moveToTop,
      remove,
      clear,
      setShuffle,
      setRepeat,
      cancelUpNext,
      playNextNow,
      playNow,
      playPrevious,
    ],
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useQueue must be used inside QueueProvider');
  return ctx;
}
