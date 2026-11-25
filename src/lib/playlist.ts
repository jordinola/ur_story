import { playNext, shiftQueue } from './queue';
import type { Story } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';

export type PlaylistState = {
  queue: Story[];
  history: Story[];
  shuffle: boolean;
  repeat: RepeatMode;
};

export const HISTORY_CAP = 50;
export const PREVIOUS_RESTART_SEC = 3;

export const emptyPlaylist: PlaylistState = {
  queue: [],
  history: [],
  shuffle: false,
  repeat: 'off',
};

/** Returns a number in [0, 1), like Math.random. */
export type RandomSource = () => number;

export type PreviousResult =
  | { action: 'restart' }
  | { action: 'play'; story: Story; state: PlaylistState };

export type NextResult =
  | { type: 'play'; story: Story; state: PlaylistState }
  | { type: 'replay' }
  | { type: 'stop' };

export function recordPlayed(state: PlaylistState, story: Story): PlaylistState {
  if (state.history.at(-1)?.id === story.id) return state;
  return { ...state, history: [...state.history, story].slice(-HISTORY_CAP) };
}

export function setShuffle(
  state: PlaylistState,
  on: boolean,
  random: RandomSource = Math.random,
): PlaylistState {
  if (!on) return { ...state, shuffle: false };
  return { ...state, shuffle: true, queue: shuffled(state.queue, random) };
}

export function setRepeat(state: PlaylistState, mode: RepeatMode): PlaylistState {
  return { ...state, repeat: mode };
}

export function previous(
  state: PlaylistState,
  current: Story,
  positionSec: number,
): PreviousResult {
  const story = state.history.at(-1);
  if (positionSec > PREVIOUS_RESTART_SEC || !story) return { action: 'restart' };
  return {
    action: 'play',
    story,
    state: {
      ...state,
      history: state.history.slice(0, -1),
      queue: playNext(state.queue, current),
    },
  };
}

/** What plays when the current story finishes on its own. */
export function afterFinish(
  state: PlaylistState,
  current: Story,
  random: RandomSource = Math.random,
): NextResult {
  if (state.repeat === 'one') return { type: 'replay' };
  return advance(state, current, random);
}

/** What plays on an explicit Next tap: Repeat one is treated as off. */
export function next(
  state: PlaylistState,
  current: Story,
  random: RandomSource = Math.random,
): NextResult {
  return advance(state, current, random);
}

export function canNext(state: PlaylistState): boolean {
  return state.queue.length > 0 || state.repeat === 'all';
}

function advance(state: PlaylistState, current: Story, random: RandomSource): NextResult {
  const { next: head, rest } = shiftQueue(state.queue);
  if (head) return { type: 'play', story: head, state: { ...state, queue: rest } };
  if (state.repeat !== 'all') return { type: 'stop' };
  return restartLoop(state, current, random);
}

/**
 * Repeat all with an empty queue: replay everything played so far plus the
 * current story. The story that just finished goes last so it never plays twice
 * in a row. History is cleared so the next pass starts from a clean copy.
 */
function restartLoop(state: PlaylistState, current: Story, random: RandomSource): NextResult {
  const earlier = state.history.filter((story) => story.id !== current.id);
  const unique = uniqueById([...earlier, current]);
  if (unique.length === 1) return { type: 'replay' };
  const loop = state.shuffle ? avoidFirst(shuffled(unique, random), current) : unique;
  const [story, ...queue] = loop;
  return { type: 'play', story, state: { ...state, queue, history: [] } };
}

function uniqueById(stories: Story[]): Story[] {
  const seen = new Set<string>();
  return stories.filter((story) => {
    if (seen.has(story.id)) return false;
    seen.add(story.id);
    return true;
  });
}

/** Fisher-Yates shuffle into a new array. */
function shuffled(stories: Story[], random: RandomSource): Story[] {
  const result = [...stories];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Swaps the first two stories when the list would start with `story`. */
function avoidFirst(stories: Story[], story: Story): Story[] {
  if (stories.length < 2 || stories[0].id !== story.id) return stories;
  const [first, second, ...rest] = stories;
  return [second, first, ...rest];
}
