import {
  afterFinish,
  canNext,
  emptyPlaylist,
  HISTORY_CAP,
  next,
  previous,
  recordPlayed,
  setRepeat,
  setShuffle,
  type PlaylistState,
} from './playlist';
import { makeStory } from '../test/fixtures';

const a = makeStory({ id: 'a' });
const b = makeStory({ id: 'b' });
const c = makeStory({ id: 'c' });
const d = makeStory({ id: 'd' });
const ids = (stories: { id: string }[]) => stories.map((story) => story.id);
const playlist = (overrides: Partial<PlaylistState> = {}): PlaylistState => ({
  ...emptyPlaylist,
  ...overrides,
});
// Always picks index 0 in Fisher-Yates, which rotates the list deterministically.
const alwaysZero = () => 0;

describe('playlist', () => {
  it('recordPlayed appends and caps the history', () => {
    expect(ids(recordPlayed(playlist({ history: [a] }), b).history)).toEqual(['a', 'b']);

    const full = Array.from({ length: HISTORY_CAP }, (_, index) =>
      makeStory({ id: `s${index}` }),
    );
    const capped = recordPlayed(playlist({ history: full }), d).history;
    expect(capped).toHaveLength(HISTORY_CAP);
    expect(capped[0].id).toBe('s1');
    expect(capped[HISTORY_CAP - 1].id).toBe('d');
  });

  it('recordPlayed skips a repeat of the last entry', () => {
    expect(ids(recordPlayed(playlist({ history: [a, b] }), b).history)).toEqual(['a', 'b']);
    expect(ids(recordPlayed(playlist({ history: [a, b] }), a).history)).toEqual(['a', 'b', 'a']);
  });

  it('setShuffle on shuffles the queue with the given random source', () => {
    const state = setShuffle(playlist({ queue: [a, b, c] }), true, alwaysZero);
    expect(state.shuffle).toBe(true);
    // Fisher-Yates with j = 0: i=2 swaps 2<->0 [c,b,a], i=1 swaps 1<->0 [b,c,a].
    expect(ids(state.queue)).toEqual(['b', 'c', 'a']);
  });

  it('setShuffle off keeps the order', () => {
    const state = setShuffle(playlist({ queue: [a, b, c], shuffle: true }), false, alwaysZero);
    expect(state.shuffle).toBe(false);
    expect(ids(state.queue)).toEqual(['a', 'b', 'c']);
  });

  it('setRepeat sets the mode', () => {
    expect(setRepeat(playlist(), 'all').repeat).toBe('all');
    expect(setRepeat(playlist({ repeat: 'all' }), 'one').repeat).toBe('one');
  });

  it('previous restarts after more than 3 seconds', () => {
    expect(previous(playlist({ history: [a] }), b, 3.5)).toEqual({ action: 'restart' });
  });

  it('previous goes back at exactly 3 seconds', () => {
    expect(previous(playlist({ history: [a] }), b, 3).action).toBe('play');
  });

  it('previous restarts when there is no history', () => {
    expect(previous(playlist(), a, 0)).toEqual({ action: 'restart' });
  });

  it('previous goes back and puts the current story first in the queue', () => {
    const result = previous(playlist({ history: [a, b], queue: [d, c] }), c, 1);
    if (result.action !== 'play') throw new Error('expected play');
    expect(result.story.id).toBe('b');
    expect(ids(result.state.history)).toEqual(['a']);
    expect(ids(result.state.queue)).toEqual(['c', 'd']);
  });

  it('afterFinish with repeat one replays', () => {
    expect(afterFinish(playlist({ repeat: 'one', queue: [b] }), a)).toEqual({ type: 'replay' });
  });

  it('afterFinish plays the queue head', () => {
    const result = afterFinish(playlist({ queue: [b, c], history: [d] }), a);
    if (result.type !== 'play') throw new Error('expected play');
    expect(result.story.id).toBe('b');
    expect(ids(result.state.queue)).toEqual(['c']);
    expect(ids(result.state.history)).toEqual(['d']);
  });

  it('afterFinish with repeat off and an empty queue stops', () => {
    expect(afterFinish(playlist({ history: [b] }), a)).toEqual({ type: 'stop' });
  });

  it('afterFinish with repeat all rebuilds the loop from de-duplicated history plus current and clears history', () => {
    const result = afterFinish(playlist({ repeat: 'all', history: [a, b, a, c] }), d);
    if (result.type !== 'play') throw new Error('expected play');
    expect(result.story.id).toBe('a');
    expect(ids(result.state.queue)).toEqual(['b', 'c', 'd']);
    expect(result.state.history).toEqual([]);
  });

  it('afterFinish with repeat all puts the finished story last, de-duplicated against history', () => {
    const result = afterFinish(playlist({ repeat: 'all', history: [a, b] }), a);
    if (result.type !== 'play') throw new Error('expected play');
    expect(result.story.id).toBe('b');
    expect(ids(result.state.queue)).toEqual(['a']);
  });

  // Models the provider: on every finish it applies afterFinish, then records the
  // story that just finished into history (optionally skipping it at a loop restart).
  const playLoops = (recordAtRestart: boolean, finishes: number) => {
    let state = playlist({ repeat: 'all', history: [a, b] });
    let current = c;
    const played: string[] = [];
    for (let count = 0; count < finishes; count += 1) {
      const isRestart = state.queue.length === 0;
      const step = afterFinish(state, current);
      if (step.type !== 'play') throw new Error('expected play');
      state = isRestart && !recordAtRestart ? step.state : recordPlayed(step.state, current);
      current = step.story;
      played.push(current.id);
    }
    return played;
  };

  it('a second repeat all pass does not double the list', () => {
    // Pass 1 starts after c finishes; pass 2 starts after c finishes again.
    expect(playLoops(true, 6)).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
    expect(playLoops(false, 6)).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  it('afterFinish with repeat all and nothing else replays the current story', () => {
    expect(afterFinish(playlist({ repeat: 'all' }), a)).toEqual({ type: 'replay' });
    expect(afterFinish(playlist({ repeat: 'all', history: [a] }), a)).toEqual({ type: 'replay' });
  });

  it('repeat all shuffled loop does not start with the story that just finished', () => {
    // [a, b] shuffled with j = 0 becomes [b, a], which would start with the finished story b.
    const result = afterFinish(
      playlist({ repeat: 'all', shuffle: true, history: [a] }),
      b,
      alwaysZero,
    );
    if (result.type !== 'play') throw new Error('expected play');
    expect(result.story.id).not.toBe('b');
    expect(ids([result.story, ...result.state.queue]).sort()).toEqual(['a', 'b']);

    for (const value of [0, 0.3, 0.6, 0.99]) {
      const shuffled = afterFinish(
        playlist({ repeat: 'all', shuffle: true, history: [a, b, c] }),
        d,
        () => value,
      );
      if (shuffled.type !== 'play') throw new Error('expected play');
      expect(shuffled.story.id).not.toBe('d');
      expect(ids([shuffled.story, ...shuffled.state.queue]).sort()).toEqual(['a', 'b', 'c', 'd']);
    }
  });

  it('next ignores repeat one', () => {
    const result = next(playlist({ repeat: 'one', queue: [b] }), a);
    if (result.type !== 'play') throw new Error('expected play');
    expect(result.story.id).toBe('b');
    expect(next(playlist({ repeat: 'one' }), a)).toEqual({ type: 'stop' });
    expect(next(playlist({ repeat: 'off' }), a)).toEqual({ type: 'stop' });
    const looped = next(playlist({ repeat: 'all', history: [b] }), a);
    if (looped.type !== 'play') throw new Error('expected play');
    expect(looped.story.id).toBe('b');
  });

  it('canNext is true with a queue or repeat all', () => {
    expect(canNext(playlist())).toBe(false);
    expect(canNext(playlist({ repeat: 'one' }))).toBe(false);
    expect(canNext(playlist({ queue: [a] }))).toBe(true);
    expect(canNext(playlist({ repeat: 'all' }))).toBe(true);
  });

  it('functions never mutate their input', () => {
    const state = Object.freeze(
      playlist({
        queue: Object.freeze([a, b]) as unknown as typeof a[],
        history: Object.freeze([c, d]) as unknown as typeof a[],
        repeat: 'all',
      }),
    );
    expect(() => {
      recordPlayed(state, a);
      setShuffle(state, true, alwaysZero);
      setShuffle(state, false);
      setRepeat(state, 'one');
      previous(state, a, 0);
      afterFinish(state, a, alwaysZero);
      next(state, a, alwaysZero);
      afterFinish({ ...state, queue: [], shuffle: true }, a, alwaysZero);
      canNext(state);
    }).not.toThrow();
    expect(ids(state.queue)).toEqual(['a', 'b']);
    expect(ids(state.history)).toEqual(['c', 'd']);
    expect(state.repeat).toBe('all');
  });
});
