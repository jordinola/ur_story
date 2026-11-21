import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { bundledCatalog } from './catalog';
import { LibraryProvider, useLibrary } from './LibraryProvider';

const STATE_KEY = 'storytime:library:v1';
const wrapper = ({ children }: { children: ReactNode }) => <LibraryProvider>{children}</LibraryProvider>;

async function setup() {
  const hook = await renderHook(() => useLibrary(), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  await waitFor(() => expect(hook.result.current.stories.length).toBeGreaterThan(0));
  return hook;
}

async function persisted() {
  const raw = await AsyncStorage.getItem(STATE_KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useLibrary', () => {
  it('throws outside of LibraryProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useLibrary())).rejects.toThrow(
      'useLibrary must be used inside LibraryProvider',
    );
    spy.mockRestore();
  });
});

describe('LibraryProvider', () => {
  it('loads the bundled catalog and becomes ready with empty state', async () => {
    const { result } = await setup();

    expect(result.current.stories).toEqual(bundledCatalog);
    expect(result.current.favorites).toEqual([]);
    expect(result.current.getProgress('any')).toBe(0);
    expect(result.current.isCompleted('any')).toBe(false);
  });

  it('restores saved state from storage', async () => {
    await AsyncStorage.setItem(
      STATE_KEY,
      JSON.stringify({ favorites: ['a'], progress: { a: 42 }, completed: ['b'] }),
    );

    const { result } = await setup();

    expect(result.current.isFavorite('a')).toBe(true);
    expect(result.current.getProgress('a')).toBe(42);
    expect(result.current.isCompleted('b')).toBe(true);
  });

  it('fills missing fields of partial saved state with defaults', async () => {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ favorites: ['a'] }));

    const { result } = await setup();

    expect(result.current.favorites).toEqual(['a']);
    expect(result.current.getProgress('a')).toBe(0);
    expect(result.current.isCompleted('a')).toBe(false);
  });

  it('starts fresh when saved state is corrupt and still becomes ready', async () => {
    await AsyncStorage.setItem(STATE_KEY, '{oops');

    const { result } = await setup();

    expect(result.current.favorites).toEqual([]);
  });

  it('does not overwrite saved data with empty state during the initial load', async () => {
    const saved = { favorites: ['a'], progress: {}, completed: [] };
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));

    await setup();

    expect(await persisted()).toEqual(saved);
  });

  describe('favorites', () => {
    it('toggles a favorite on and off and persists it', async () => {
      const { result } = await setup();

      await act(async () => result.current.toggleFavorite('a'));
      expect(result.current.isFavorite('a')).toBe(true);
      await waitFor(async () => expect((await persisted()).favorites).toEqual(['a']));

      await act(async () => result.current.toggleFavorite('a'));
      expect(result.current.isFavorite('a')).toBe(false);
      await waitFor(async () => expect((await persisted()).favorites).toEqual([]));
    });
  });

  describe('progress', () => {
    it('saves progress per story', async () => {
      const { result } = await setup();

      await act(async () => result.current.saveProgress('a', 30));
      await act(async () => result.current.saveProgress('b', 90));

      expect(result.current.getProgress('a')).toBe(30);
      expect(result.current.getProgress('b')).toBe(90);
    });

    it('clamps negative progress to zero', async () => {
      const { result } = await setup();

      await act(async () => result.current.saveProgress('a', -5));

      expect(result.current.getProgress('a')).toBe(0);
    });
  });

  describe('completion', () => {
    it('marks a story completed and resets its progress', async () => {
      const { result } = await setup();
      await act(async () => result.current.saveProgress('a', 120));

      await act(async () => result.current.markCompleted('a'));

      expect(result.current.isCompleted('a')).toBe(true);
      expect(result.current.getProgress('a')).toBe(0);
    });

    it('does not duplicate completed entries', async () => {
      const { result } = await setup();

      await act(async () => result.current.markCompleted('a'));
      await act(async () => result.current.markCompleted('a'));

      await waitFor(async () => expect((await persisted()).completed).toEqual(['a']));
    });
  });

  describe('getStory', () => {
    it('finds a story by id and returns undefined for unknown ids', async () => {
      const { result } = await setup();
      const first = bundledCatalog[0];

      expect(result.current.getStory(first.id)).toEqual(first);
      expect(result.current.getStory('nope')).toBeUndefined();
    });
  });
});
