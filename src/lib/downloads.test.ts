import { makeStory } from '../test/fixtures';
import {
  audioExtension,
  downloadFileName,
  formatBytes,
  isPartFile,
  partFileName,
  storyIdFromFileName,
} from './downloads';

describe('audioExtension', () => {
  it('reads the extension and defaults to mp3', () => {
    expect(audioExtension('audio/sleepy-moon.mp3')).toBe('mp3');
    expect(audioExtension('audio/sleepy-moon.M4A')).toBe('m4a');
    expect(audioExtension('audio/sleepy-moon')).toBe('mp3');
    expect(audioExtension('')).toBe('mp3');
    expect(audioExtension('audio/sleepy-moon.')).toBe('mp3');
    expect(audioExtension('audio/sleepy-moon.m-4a')).toBe('mp3');
  });

  it('ignores query strings and hashes', () => {
    expect(audioExtension('https://x/y/a.MP3?t=1#h')).toBe('mp3');
    expect(audioExtension('https://x/y/a.m4a#frag')).toBe('m4a');
    expect(audioExtension('https://x.com/y/a?file=b.wav')).toBe('mp3');
  });
});

describe('file names', () => {
  it('downloadFileName builds id.ext', () => {
    expect(downloadFileName(makeStory({ id: 'sleepy-moon' }))).toBe('sleepy-moon.mp3');
    expect(downloadFileName(makeStory({ id: 'a', audio: 'x/a.m4a' }))).toBe('a.m4a');
  });

  it('partFileName appends .part', () => {
    expect(partFileName(makeStory({ id: 'sleepy-moon' }))).toBe('sleepy-moon.mp3.part');
  });

  it('storyIdFromFileName returns the id', () => {
    expect(storyIdFromFileName('sleepy-moon.mp3')).toBe('sleepy-moon');
  });

  it('storyIdFromFileName ignores part files and extensionless names', () => {
    expect(storyIdFromFileName('sleepy-moon.mp3.part')).toBeNull();
    expect(storyIdFromFileName('sleepy-moon')).toBeNull();
    expect(storyIdFromFileName('.mp3')).toBeNull();
    expect(isPartFile('a.mp3.part')).toBe(true);
    expect(isPartFile('a.mp3')).toBe(false);
  });

  it('ids that contain dots survive the round trip', () => {
    const story = makeStory({ id: 'my.story.v2' });
    expect(downloadFileName(story)).toBe('my.story.v2.mp3');
    expect(storyIdFromFileName(downloadFileName(story))).toBe('my.story.v2');
  });
});

describe('formatBytes', () => {
  it('formats KB MB and GB', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(842 * 1024)).toBe('842 KB');
    expect(formatBytes(4.2 * 1024 * 1024)).toBe('4.2 MB');
    expect(formatBytes(1.3 * 1024 * 1024 * 1024)).toBe('1.3 GB');
  });

  it('can drop a trailing .0 from MB and GB sizes', () => {
    const MB = 1024 * 1024;
    expect(formatBytes(42 * MB, { trimZero: true })).toBe('42 MB');
    expect(formatBytes(4.2 * MB, { trimZero: true })).toBe('4.2 MB');
    expect(formatBytes(2 * 1024 * MB, { trimZero: true })).toBe('2 GB');
    expect(formatBytes(1.3 * 1024 * MB, { trimZero: true })).toBe('1.3 GB');
    expect(formatBytes(842 * 1024, { trimZero: true })).toBe('842 KB');
    expect(formatBytes(42 * MB)).toBe('42.0 MB');
  });

  it('never goes negative', () => {
    expect(formatBytes(-5)).toBe('0 KB');
    expect(formatBytes(NaN)).toBe('0 KB');
    expect(formatBytes(Infinity)).toBe('0 KB');
  });
});
