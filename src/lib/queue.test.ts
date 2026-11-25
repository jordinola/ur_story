import { enqueue, moveToTop, playNext, removeFromQueue, shiftQueue } from './queue';
import { makeStory } from '../test/fixtures';

const a = makeStory({ id: 'a' });
const b = makeStory({ id: 'b' });
const c = makeStory({ id: 'c' });
const ids = (stories: { id: string }[]) => stories.map((story) => story.id);

describe('queue', () => {
  it('enqueue appends', () => {
    expect(ids(enqueue([a, b], c))).toEqual(['a', 'b', 'c']);
  });

  it('enqueue moves an existing story to the end instead of duplicating', () => {
    expect(ids(enqueue([a, b, c], a))).toEqual(['b', 'c', 'a']);
  });

  it('playNext inserts first and de-duplicates', () => {
    expect(ids(playNext([a, b], c))).toEqual(['c', 'a', 'b']);
    expect(ids(playNext([a, b, c], c))).toEqual(['c', 'a', 'b']);
  });

  it('moveToTop moves the story to index 0', () => {
    expect(ids(moveToTop([a, b, c], 'c'))).toEqual(['c', 'a', 'b']);
  });

  it('moveToTop ignores an unknown id', () => {
    const queue = [a, b];
    expect(moveToTop(queue, 'zzz')).toBe(queue);
  });

  it('removeFromQueue drops by id', () => {
    expect(ids(removeFromQueue([a, b, c], 'b'))).toEqual(['a', 'c']);
  });

  it('shiftQueue returns the head and the rest', () => {
    const { next, rest } = shiftQueue([a, b, c]);
    expect(next?.id).toBe('a');
    expect(ids(rest)).toEqual(['b', 'c']);
  });

  it('shiftQueue on an empty queue returns next null', () => {
    expect(shiftQueue([])).toEqual({ next: null, rest: [] });
  });

  it('functions never mutate their input', () => {
    const queue = Object.freeze([a, b, c]) as unknown as typeof a[];
    expect(() => {
      enqueue(queue, a);
      enqueue(queue, makeStory({ id: 'd' }));
      playNext(queue, c);
      moveToTop(queue, 'c');
      removeFromQueue(queue, 'a');
      shiftQueue(queue);
    }).not.toThrow();
    expect(ids(queue)).toEqual(['a', 'b', 'c']);
  });
});
