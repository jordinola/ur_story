import type { Story } from '../types';

export function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-1',
    title: 'The Sleepy Moon',
    description: 'A moon who cannot sleep.',
    durationSec: 300,
    ageRange: '3-6',
    language: 'en',
    audio: 'audio/sleepy-moon.mp3',
    color: '#7C83FD',
    emoji: '🌙',
    ...overrides,
  };
}
