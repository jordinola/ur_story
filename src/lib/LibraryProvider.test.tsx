import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { bundledCatalog } from './catalog';
import { LibraryProvider, useLibrary } from './LibraryProvider';
import { ProfilesProvider, useProfiles } from './ProfilesProvider';
import type { LibraryState, Profile } from '../types';

const STATE_KEY = 'storytime:library:v2';
const V1_KEY = 'storytime:library:v1';
const PROFILES_KEY = 'storytime:profiles:v1';
const EMPTY: LibraryState = { favorites: [], progress: {}, completed: [] };

type ProfilesValue = ReturnType<typeof useProfiles>;

// null means "use the real ProfilesProvider" (integration tests); otherwise tests control the value.
let mockProfiles: ProfilesValue | null = null;
jest.mock('./ProfilesProvider', () => {
  const actual = jest.requireActual<typeof import('./ProfilesProvider')>('./ProfilesProvider');
  return { ...actual, useProfiles: () => mockProfiles ?? actual.useProfiles() };
});

const profile = (id: string): Profile => ({
  id,
  name: id.toUpperCase(),
  age: 6,
  tags: [],
  languages: ['en'],
  color: '#1D4ED8',
});

function setProfiles(patch: Partial<ProfilesValue> = {}) {
  const base: ProfilesValue = {
    ready: true,
    trusted: true,
    profiles: [],
    activeProfile: null,
    activeId: null,
    setActive: jest.fn(),
    createProfile: jest.fn(() => null),
    updateProfile: jest.fn(),
    deleteProfile: jest.fn(),
  };
  const next = { ...base, ...patch };
  mockProfiles = { ...next, activeProfile: next.profiles.find((p) => p.id === next.activeId) ?? null };
}

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

function librarySetItemCalls() {
  return jest.mocked(AsyncStorage.setItem).mock.calls.filter(([key]) => key === STATE_KEY);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.getItem).mockClear();
  jest.mocked(AsyncStorage.setItem).mockClear();
  setProfiles();
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
  it('reports loading until saved state and the catalog have both loaded', async () => {
    const releases: (() => void)[] = [];
    const pending = () => new Promise<null>((resolve) => releases.push(() => resolve(null)));
    // Saved library state and the cached catalog are each read; hold both open.
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(pending).mockImplementationOnce(pending);

    const hook = await renderHook(() => useLibrary(), { wrapper });
    expect(hook.result.current.loading).toBe(true);

    await act(async () => {
      releases.forEach((release) => release());
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.stories.length).toBeGreaterThan(0);
  });

  it('stays loading and not ready until profiles are ready', async () => {
    setProfiles({ ready: false });
    const hook = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(hook.result.current.stories.length).toBeGreaterThan(0));
    await act(async () => {});

    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.ready).toBe(false);

    setProfiles({ ready: true });
    await hook.rerender({});
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.ready).toBe(true);
  });

  it('loads the bundled catalog and becomes ready with empty state', async () => {
    const { result } = await setup();

    expect(result.current.stories).toEqual(bundledCatalog);
    expect(result.current.favorites).toEqual([]);
    expect(result.current.progress).toEqual({});
    expect(result.current.completed).toEqual([]);
    expect(result.current.getProgress('any')).toBe(0);
    expect(result.current.isCompleted('any')).toBe(false);
  });

  it('restores saved shared state from storage', async () => {
    await AsyncStorage.setItem(
      STATE_KEY,
      JSON.stringify({ shared: { favorites: ['a'], progress: { a: 42 }, completed: ['b'] }, byProfile: {} }),
    );

    const { result } = await setup();

    expect(result.current.isFavorite('a')).toBe(true);
    expect(result.current.getProgress('a')).toBe(42);
    expect(result.current.progress).toEqual({ a: 42 });
    expect(result.current.isCompleted('b')).toBe(true);
    expect(result.current.completed).toEqual(['b']);
  });

  it('fills missing fields of partial saved state with defaults', async () => {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared: { favorites: ['a'] } }));

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
    const saved = { shared: { favorites: ['a'], progress: {}, completed: [] }, byProfile: {} };
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));

    await setup();

    expect(await persisted()).toEqual(saved);
  });

  it('never persists before profiles and saved state have loaded', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({ favorites: ['a'], progress: {}, completed: [] }));
    jest.mocked(AsyncStorage.setItem).mockClear();
    setProfiles({ ready: false });

    const hook = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(hook.result.current.stories.length).toBeGreaterThan(0));
    await act(async () => hook.result.current.toggleFavorite('z'));

    expect(librarySetItemCalls()).toEqual([]);
  });

  it('ignores mutations made before it has loaded so saved data is not clobbered', async () => {
    const saved = { shared: { favorites: ['a'], progress: {}, completed: [] }, byProfile: {} };
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));
    setProfiles({ ready: false });

    const hook = await renderHook(() => useLibrary(), { wrapper });
    await act(async () => hook.result.current.toggleFavorite('a'));
    setProfiles({ ready: true });
    await hook.rerender({});
    await waitFor(() => expect(hook.result.current.ready).toBe(true));

    expect(hook.result.current.favorites).toEqual(['a']);
    expect(await persisted()).toEqual(saved);
  });

  it('does not persist at all when reading saved state fails, so nothing is overwritten', async () => {
    const saved = { shared: { favorites: ['a'], progress: {}, completed: [] }, byProfile: {} };
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));
    jest.mocked(AsyncStorage.setItem).mockClear();
    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => Promise.reject(new Error('disk')));

    const { result } = await setup();
    await act(async () => result.current.toggleFavorite('b'));

    expect(result.current.isFavorite('b')).toBe(true);
    expect(librarySetItemCalls()).toEqual([]);
    expect(await persisted()).toEqual(saved);
  });

  describe('v1 migration', () => {
    const v1 = { favorites: ['a'], progress: { a: 42 }, completed: ['b'] };

    it('migrates v1 data into shared when v2 is absent and leaves v1 untouched', async () => {
      await AsyncStorage.setItem(V1_KEY, JSON.stringify(v1));
      jest.mocked(AsyncStorage.setItem).mockClear();

      const { result } = await setup();

      expect(result.current.favorites).toEqual(['a']);
      expect(result.current.getProgress('a')).toBe(42);
      expect(result.current.isCompleted('b')).toBe(true);
      await waitFor(async () => expect(await persisted()).toEqual({ shared: v1, byProfile: {} }));
      expect(JSON.parse((await AsyncStorage.getItem(V1_KEY)) ?? 'null')).toEqual(v1);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(V1_KEY);
      expect(jest.mocked(AsyncStorage.setItem).mock.calls.some(([key]) => key === V1_KEY)).toBe(false);
    });

    it('ignores v1 once v2 exists', async () => {
      await AsyncStorage.setItem(V1_KEY, JSON.stringify(v1));
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared: EMPTY, byProfile: {} }));

      const { result } = await setup();

      expect(result.current.favorites).toEqual([]);
    });

    it('migrates partial v1 data with defaults', async () => {
      await AsyncStorage.setItem(V1_KEY, JSON.stringify({ favorites: ['a'] }));

      const { result } = await setup();

      expect(result.current.favorites).toEqual(['a']);
      expect(result.current.getProgress('a')).toBe(0);
    });

    it('falls back to v1 when v2 is corrupt, and leaves v1 untouched', async () => {
      await AsyncStorage.setItem(V1_KEY, JSON.stringify(v1));
      await AsyncStorage.setItem(STATE_KEY, '{oops');

      const { result } = await setup();

      expect(result.current.favorites).toEqual(['a']);
      expect(result.current.getProgress('a')).toBe(42);
      expect(JSON.parse((await AsyncStorage.getItem(V1_KEY)) ?? 'null')).toEqual(v1);
    });

    it('falls back to v1 when v2 parses but is not a record', async () => {
      await AsyncStorage.setItem(V1_KEY, JSON.stringify(v1));
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify([1, 2]));

      const { result } = await setup();

      expect(result.current.favorites).toEqual(['a']);
    });

    it('starts fresh when v1 is corrupt', async () => {
      await AsyncStorage.setItem(V1_KEY, '{oops');

      const { result } = await setup();

      expect(result.current.favorites).toEqual([]);
    });

    it('lets the first profile adopt migrated v1 data', async () => {
      await AsyncStorage.setItem(V1_KEY, JSON.stringify(v1));
      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });

      const { result } = await setup();

      expect(result.current.favorites).toEqual(['a']);
      await waitFor(async () =>
        expect(await persisted()).toEqual({ shared: EMPTY, byProfile: { k1: v1 } }),
      );
    });
  });

  describe('profiles', () => {
    it('isolates favorites, progress and completion per profile and swaps them on switch', async () => {
      setProfiles({ profiles: [profile('k1'), profile('k2')], activeId: 'k1' });
      const hook = await setup();

      await act(async () => hook.result.current.toggleFavorite('a'));
      await act(async () => hook.result.current.saveProgress('a', 30));
      await act(async () => hook.result.current.markCompleted('c'));

      setProfiles({ profiles: [profile('k1'), profile('k2')], activeId: 'k2' });
      await hook.rerender({});
      expect(hook.result.current.favorites).toEqual([]);
      expect(hook.result.current.getProgress('a')).toBe(0);
      expect(hook.result.current.isCompleted('c')).toBe(false);

      await act(async () => hook.result.current.toggleFavorite('b'));

      setProfiles({ profiles: [profile('k1'), profile('k2')], activeId: 'k1' });
      await hook.rerender({});
      expect(hook.result.current.favorites).toEqual(['a']);
      expect(hook.result.current.getProgress('a')).toBe(30);
      expect(hook.result.current.isCompleted('c')).toBe(true);

      await waitFor(async () =>
        expect(await persisted()).toEqual({
          shared: EMPTY,
          byProfile: {
            k1: { favorites: ['a'], progress: { a: 30, c: 0 }, completed: ['c'] },
            k2: { favorites: ['b'], progress: {}, completed: [] },
          },
        }),
      );
    });

    it('restores a saved profile slice', async () => {
      const k1 = { favorites: ['x'], progress: { x: 5 }, completed: [] };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared: EMPTY, byProfile: { k1 } }));
      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });

      const { result } = await setup();

      expect(result.current.favorites).toEqual(['x']);
      expect(result.current.getProgress('x')).toBe(5);
    });

    it('has the first profile adopt a non-empty shared slice and resets shared', async () => {
      const shared = { favorites: ['a'], progress: { a: 9 }, completed: ['b'] };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared, byProfile: {} }));
      const hook = await setup();
      expect(hook.result.current.favorites).toEqual(['a']);

      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });
      await hook.rerender({});

      expect(hook.result.current.favorites).toEqual(['a']);
      expect(hook.result.current.getProgress('a')).toBe(9);
      await waitFor(async () => expect(await persisted()).toEqual({ shared: EMPTY, byProfile: { k1: shared } }));
    });

    it('starts a second profile empty', async () => {
      const shared = { favorites: ['a'], progress: {}, completed: [] };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared, byProfile: {} }));
      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });
      const hook = await setup();
      await waitFor(async () => expect((await persisted()).byProfile).toEqual({ k1: shared }));

      setProfiles({ profiles: [profile('k1'), profile('k2')], activeId: 'k2' });
      await hook.rerender({});

      expect(hook.result.current.favorites).toEqual([]);
      await act(async () => hook.result.current.toggleFavorite('b'));
      await waitFor(async () =>
        expect(await persisted()).toEqual({
          shared: EMPTY,
          byProfile: { k1: shared, k2: { favorites: ['b'], progress: {}, completed: [] } },
        }),
      );
    });

    it('does not adopt shared when another profile already has a slice', async () => {
      const shared = { favorites: ['s'], progress: {}, completed: [] };
      const k1 = { favorites: ['x'], progress: {}, completed: [] };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared, byProfile: { k1 } }));
      setProfiles({ profiles: [profile('k1'), profile('k2')], activeId: 'k2' });

      const { result } = await setup();

      expect(result.current.favorites).toEqual([]);
      await act(async () => result.current.toggleFavorite('y'));
      await waitFor(async () =>
        expect(await persisted()).toEqual({
          shared,
          byProfile: { k1, k2: { favorites: ['y'], progress: {}, completed: [] } },
        }),
      );
    });

    it('prunes slices of deleted profiles', async () => {
      const k1 = { favorites: ['x'], progress: {}, completed: [] };
      const k2 = { favorites: ['y'], progress: {}, completed: [] };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared: EMPTY, byProfile: { k1, k2 } }));
      setProfiles({ profiles: [profile('k1'), profile('k2')], activeId: 'k2' });
      const hook = await setup();
      expect(hook.result.current.favorites).toEqual(['y']);

      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });
      await hook.rerender({});

      expect(hook.result.current.favorites).toEqual(['x']);
      await waitFor(async () => expect(await persisted()).toEqual({ shared: EMPTY, byProfile: { k1 } }));
    });

    it('returns to the empty shared state when all profiles are deleted', async () => {
      const k1 = { favorites: ['x'], progress: {}, completed: [] };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared: EMPTY, byProfile: { k1 } }));
      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });
      const hook = await setup();

      setProfiles({ profiles: [], activeId: null });
      await hook.rerender({});

      expect(hook.result.current.favorites).toEqual([]);
      await waitFor(async () => expect(await persisted()).toEqual({ shared: EMPTY, byProfile: {} }));
    });

    it('does not prune or adopt before profiles are ready', async () => {
      const saved = {
        shared: { favorites: ['s'], progress: {}, completed: [] },
        byProfile: { k1: { favorites: ['x'], progress: {}, completed: [] } },
      };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));
      jest.mocked(AsyncStorage.setItem).mockClear();
      setProfiles({ ready: false });

      const hook = await renderHook(() => useLibrary(), { wrapper });
      await waitFor(() => expect(hook.result.current.stories.length).toBeGreaterThan(0));
      await act(async () => {});

      expect(librarySetItemCalls()).toEqual([]);
      expect(await persisted()).toEqual(saved);

      setProfiles({ ready: true, profiles: [profile('k1')], activeId: 'k1' });
      await hook.rerender({});
      await waitFor(() => expect(hook.result.current.ready).toBe(true));

      expect(hook.result.current.favorites).toEqual(['x']);
      await waitFor(async () => expect(await persisted()).toEqual(saved));
    });

    it('neither prunes, adopts nor saves when profiles could not be read', async () => {
      const saved = {
        shared: { favorites: ['s'], progress: {}, completed: [] },
        byProfile: { k1: { favorites: ['x'], progress: {}, completed: [] } },
      };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));
      jest.mocked(AsyncStorage.setItem).mockClear();
      setProfiles({ trusted: false, profiles: [profile('k9')], activeId: 'k9' });

      const { result } = await setup();
      expect(result.current.favorites).toEqual([]);
      await act(async () => result.current.toggleFavorite('y'));
      expect(result.current.favorites).toEqual(['y']);
      await act(async () => {});

      expect(librarySetItemCalls()).toEqual([]);
      expect(await persisted()).toEqual(saved);
    });

    it('keeps slices of unknown profiles at load, and prunes only profiles deleted in-session', async () => {
      const k1 = { favorites: ['x'], progress: {}, completed: [] };
      const k2 = { favorites: ['y'], progress: {}, completed: [] };
      const orphan = { favorites: ['g'], progress: {}, completed: [] };
      const saved = { shared: EMPTY, byProfile: { k1, k2, orphan } };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));
      setProfiles({ trusted: true, profiles: [profile('k1'), profile('k2')], activeId: 'k1' });

      const hook = await setup();
      await act(async () => {});
      expect(await persisted()).toEqual(saved);

      await act(async () => hook.result.current.toggleFavorite('z'));
      await waitFor(async () =>
        expect(await persisted()).toEqual({
          shared: EMPTY,
          byProfile: { k1: { ...k1, favorites: ['x', 'z'] }, k2, orphan },
        }),
      );

      setProfiles({ trusted: true, profiles: [profile('k1')], activeId: 'k1' });
      await hook.rerender({});

      await waitFor(async () =>
        expect(await persisted()).toEqual({ shared: EMPTY, byProfile: { k1: { ...k1, favorites: ['x', 'z'] }, orphan } }),
      );
    });

    it('lets the first profile adopt shared even when orphan slices are left over', async () => {
      const shared = { favorites: ['s'], progress: {}, completed: [] };
      const orphan = { favorites: ['g'], progress: {}, completed: [] };
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({ shared, byProfile: { orphan } }));
      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });

      const { result } = await setup();

      expect(result.current.favorites).toEqual(['s']);
      await waitFor(async () =>
        expect(await persisted()).toEqual({ shared: EMPTY, byProfile: { orphan, k1: shared } }),
      );
    });

    it('drops malformed profile slices in saved state', async () => {
      await AsyncStorage.setItem(
        STATE_KEY,
        JSON.stringify({ shared: EMPTY, byProfile: { k1: { favorites: 'nope', progress: [] }, k2: 7 } }),
      );
      setProfiles({ profiles: [profile('k1')], activeId: 'k1' });

      const { result } = await setup();

      expect(result.current.favorites).toEqual([]);
      expect(result.current.progress).toEqual({});
    });
  });

  describe('favorites', () => {
    it('toggles a favorite on and off and persists it', async () => {
      const { result } = await setup();

      await act(async () => result.current.toggleFavorite('a'));
      expect(result.current.isFavorite('a')).toBe(true);
      await waitFor(async () => expect((await persisted()).shared.favorites).toEqual(['a']));

      await act(async () => result.current.toggleFavorite('a'));
      expect(result.current.isFavorite('a')).toBe(false);
      await waitFor(async () => expect((await persisted()).shared.favorites).toEqual([]));
    });
  });

  describe('progress', () => {
    it('saves progress per story', async () => {
      const { result } = await setup();

      await act(async () => result.current.saveProgress('a', 30));
      await act(async () => result.current.saveProgress('b', 90));

      expect(result.current.getProgress('a')).toBe(30);
      expect(result.current.getProgress('b')).toBe(90);
      expect(result.current.progress).toEqual({ a: 30, b: 90 });
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
      expect(result.current.completed).toEqual(['a']);
      expect(result.current.getProgress('a')).toBe(0);
    });

    it('does not duplicate completed entries', async () => {
      const { result } = await setup();

      await act(async () => result.current.markCompleted('a'));
      await act(async () => result.current.markCompleted('a'));

      await waitFor(async () => expect((await persisted()).shared.completed).toEqual(['a']));
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

describe('LibraryProvider with the real ProfilesProvider', () => {
  const both = ({ children }: { children: ReactNode }) => (
    <ProfilesProvider>
      <LibraryProvider>{children}</LibraryProvider>
    </ProfilesProvider>
  );

  beforeEach(() => {
    mockProfiles = null;
  });

  async function setupBoth() {
    const hook = await renderHook(() => ({ library: useLibrary(), profiles: useProfiles() }), { wrapper: both });
    await waitFor(() => expect(hook.result.current.library.loading).toBe(false));
    return hook;
  }

  it('keeps v1 favorites through migration and first profile creation, then isolates the second', async () => {
    await AsyncStorage.setItem(V1_KEY, JSON.stringify({ favorites: ['a'], progress: {}, completed: [] }));
    const { result } = await setupBoth();
    expect(result.current.library.favorites).toEqual(['a']);

    let first: Profile | null = null;
    await act(async () => {
      first = result.current.profiles.createProfile({
        name: 'Ana',
        age: 6,
        tags: [],
        languages: ['en'],
        color: '#1D4ED8',
      });
    });
    expect(first).not.toBeNull();
    expect(result.current.library.favorites).toEqual(['a']);

    await act(async () => {
      result.current.profiles.createProfile({ name: 'Ben', age: 5, tags: [], languages: ['en'], color: '#000' });
    });
    expect(result.current.library.favorites).toEqual([]);

    const anaId = result.current.profiles.profiles[0].id;
    await act(async () => result.current.profiles.setActive(anaId));
    expect(result.current.library.favorites).toEqual(['a']);

    await waitFor(async () => {
      const saved = await persisted();
      expect(saved.shared).toEqual(EMPTY);
      expect(saved.byProfile[anaId].favorites).toEqual(['a']);
    });
    expect(JSON.parse((await AsyncStorage.getItem(V1_KEY)) ?? 'null').favorites).toEqual(['a']);
  });

  it('waits for saved profiles before loading, so a saved profile slice is not adopted over or pruned', async () => {
    const k1 = { favorites: ['x'], progress: {}, completed: [] };
    const saved = { shared: { favorites: ['s'], progress: {}, completed: [] }, byProfile: { k1 } };
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify({ profiles: [profile('k1')], activeId: 'k1' }));

    const { result } = await setupBoth();

    expect(result.current.library.favorites).toEqual(['x']);
    await waitFor(async () => expect(await persisted()).toEqual(saved));
  });

  it('keeps saved profiles and every library slice when the profiles read fails', async () => {
    const savedProfiles = { profiles: [profile('k1'), profile('k2')], activeId: 'k1' };
    const savedLibrary = {
      shared: EMPTY,
      byProfile: {
        k1: { favorites: ['x'], progress: { x: 3 }, completed: [] },
        k2: { favorites: ['y'], progress: {}, completed: ['y'] },
      },
    };
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(savedProfiles));
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(savedLibrary));
    const realGetItem = jest.mocked(AsyncStorage.getItem).getMockImplementation();
    if (!realGetItem) throw new Error('expected the AsyncStorage mock to have an implementation');
    jest.mocked(AsyncStorage.getItem).mockImplementation((key: string) =>
      key === PROFILES_KEY ? Promise.reject(new Error('disk')) : realGetItem(key),
    );

    try {
      const { result } = await setupBoth();
      await act(async () => result.current.library.toggleFavorite('z'));
      await act(async () => result.current.library.saveProgress('z', 10));
      await act(async () => {
        result.current.profiles.createProfile({ name: 'New', age: 6, tags: [], languages: ['en'], color: '#000' });
      });
      await act(async () => result.current.library.toggleFavorite('w'));
      await act(async () => {});
    } finally {
      jest.mocked(AsyncStorage.getItem).mockImplementation(realGetItem);
    }

    expect(JSON.parse((await AsyncStorage.getItem(PROFILES_KEY)) ?? 'null')).toEqual(savedProfiles);
    expect(await persisted()).toEqual(savedLibrary);
  });

  it('removes the slice of a deleted profile', async () => {
    const { result } = await setupBoth();
    await act(async () => {
      result.current.profiles.createProfile({ name: 'Ana', age: 6, tags: [], languages: ['en'], color: '#000' });
    });
    await act(async () => result.current.library.toggleFavorite('a'));
    const anaId = result.current.profiles.profiles[0].id;
    await waitFor(async () => expect(Object.keys((await persisted()).byProfile)).toEqual([anaId]));

    await act(async () => result.current.profiles.deleteProfile(anaId));

    expect(result.current.library.favorites).toEqual([]);
    await waitFor(async () => expect(await persisted()).toEqual({ shared: EMPTY, byProfile: {} }));
  });
});
