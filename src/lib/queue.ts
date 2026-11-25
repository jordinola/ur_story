import type { Story } from '../types';

export function enqueue(queue: Story[], story: Story): Story[] {
  return [...removeFromQueue(queue, story.id), story];
}

export function playNext(queue: Story[], story: Story): Story[] {
  return [story, ...removeFromQueue(queue, story.id)];
}

export function moveToTop(queue: Story[], id: string): Story[] {
  const story = queue.find((entry) => entry.id === id);
  if (!story) return queue;
  return playNext(queue, story);
}

export function removeFromQueue(queue: Story[], id: string): Story[] {
  return queue.filter((entry) => entry.id !== id);
}

export function shiftQueue(queue: Story[]): { next: Story | null; rest: Story[] } {
  const [next = null, ...rest] = queue;
  return { next, rest };
}
