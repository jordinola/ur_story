import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ProfilesProvider, useProfiles } from './ProfilesProvider';
import type { ProfileInput } from '../types';

const KEY = 'storytime:profiles:v1';
const wrapper = ({ children }: { children: ReactNode }) => <ProfilesProvider>{children}</ProfilesProvider>;
const input = (name: string): ProfileInput => ({
  name,
  age: 6,
  tags: ['Animals'],
  languages: ['en'],
  color: '#1D4ED8',
});

async function setup() {
  const hook = await renderHook(() => useProfiles(), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

async function persisted() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.setItem).mockClear();
});

describe('useProfiles', () => {
  it('throws outside of ProfilesProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useProfiles())).rejects.toThrow(
      'useProfiles must be used inside ProfilesProvider',
    );
    spy.mockRestore();
  });
});

describe('ProfilesProvider', () => {
  it('starts empty with no active profile', async () => {
    const { result } = await setup();
    expect(result.current.profiles).toEqual([]);
    expect(result.current.activeProfile).toBeNull();
    expect(result.current.activeId).toBeNull();
  });

  it('loads saved profiles and the active one', async () => {
    const a = { id: 'a', ...input('Ana') };
    const b = { id: 'b', ...input('Ben') };
    await AsyncStorage.setItem(KEY, JSON.stringify({ profiles: [a, b], activeId: 'b' }));

    const { result } = await setup();

    expect(result.current.profiles).toEqual([a, b]);
    expect(result.current.activeProfile).toEqual(b);
  });

  it('starts empty when saved data is corrupt', async () => {
    await AsyncStorage.setItem(KEY, '{oops');
    const { result } = await setup();
    expect(result.current.profiles).toEqual([]);
  });

  it('never overwrites saved data on load', async () => {
    const saved = { profiles: [{ id: 'a', ...input('Ana') }], activeId: 'a' };
    await AsyncStorage.setItem(KEY, JSON.stringify(saved));
    jest.mocked(AsyncStorage.setItem).mockClear();

    await setup();

    // Re-saving the loaded data is fine; writing EMPTY over it is not.
    for (const [, written] of jest.mocked(AsyncStorage.setItem).mock.calls) {
      expect(JSON.parse(written)).toEqual(saved);
    }
    expect(await persisted()).toEqual(saved);
  });

  it('creates a profile, makes it active and persists it', async () => {
    const { result } = await setup();

    let created: ReturnType<typeof result.current.createProfile> = null;
    await act(async () => {
      created = result.current.createProfile(input(' Mia '));
    });

    expect(created).not.toBeNull();
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.activeId).toBe(result.current.profiles[0].id);
    expect(result.current.activeProfile?.name).toBe('Mia');
    await waitFor(async () => {
      const saved = await persisted();
      expect(saved.profiles[0].name).toBe('Mia');
      expect(saved.activeId).toBe(saved.profiles[0].id);
    });
  });

  it('returns null and adds nothing for invalid input', async () => {
    const { result } = await setup();
    let created: ReturnType<typeof result.current.createProfile> = null;
    await act(async () => {
      created = result.current.createProfile({ ...input('Mia'), age: 40 });
    });
    expect(created).toBeNull();
    expect(result.current.profiles).toEqual([]);
  });

  it('returns null for the 7th profile', async () => {
    const { result } = await setup();
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        result.current.createProfile(input(`Kid${i}`));
      });
    }
    expect(result.current.profiles).toHaveLength(6);

    let seventh: ReturnType<typeof result.current.createProfile> = null;
    await act(async () => {
      seventh = result.current.createProfile(input('Extra'));
    });

    expect(seventh).toBeNull();
    expect(result.current.profiles).toHaveLength(6);
  });

  it('generates unique ids', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.createProfile(input('A'));
      result.current.createProfile(input('B'));
    });
    const ids = result.current.profiles.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('switches the active profile', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.createProfile(input('A'));
    });
    await act(async () => {
      result.current.createProfile(input('B'));
    });
    const [first] = result.current.profiles;

    await act(async () => result.current.setActive(first.id));
    expect(result.current.activeId).toBe(first.id);

    await act(async () => result.current.setActive('ghost'));
    expect(result.current.activeId).toBe(first.id);
  });

  it('updates a profile and persists it', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.createProfile(input('Mia'));
    });
    const id = result.current.profiles[0].id;

    await act(async () => result.current.updateProfile(id, { ...input('Mia Rose'), age: 8 }));

    expect(result.current.profiles[0]).toMatchObject({ id, name: 'Mia Rose', age: 8 });
    await waitFor(async () => expect((await persisted()).profiles[0].age).toBe(8));
  });

  it('ignores invalid updates', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.createProfile(input('Mia'));
    });
    const id = result.current.profiles[0].id;

    await act(async () => result.current.updateProfile(id, { ...input(''), age: 8 }));

    expect(result.current.profiles[0].name).toBe('Mia');
  });

  it('activates the first remaining profile when the active one is deleted', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.createProfile(input('A'));
    });
    await act(async () => {
      result.current.createProfile(input('B'));
    });
    const [first, second] = result.current.profiles;
    expect(result.current.activeId).toBe(second.id);

    await act(async () => result.current.deleteProfile(second.id));
    expect(result.current.activeId).toBe(first.id);

    await act(async () => result.current.deleteProfile(first.id));
    expect(result.current.activeId).toBeNull();
    expect(result.current.activeProfile).toBeNull();
    await waitFor(async () => expect(await persisted()).toEqual({ profiles: [], activeId: null }));
  });

  it('keeps the active profile when another is deleted', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.createProfile(input('A'));
    });
    await act(async () => {
      result.current.createProfile(input('B'));
    });
    const [first, second] = result.current.profiles;

    await act(async () => result.current.deleteProfile(first.id));

    expect(result.current.activeId).toBe(second.id);
  });

  it('treats deleting an unknown id as a no-op', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.createProfile(input('A'));
    });
    const before = result.current.profiles;
    jest.mocked(AsyncStorage.setItem).mockClear();

    await act(async () => result.current.deleteProfile('ghost'));

    expect(result.current.profiles).toBe(before);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  describe('trust', () => {
    it('is trusted after a successful read, including when nothing was saved', async () => {
      const { result } = await setup();
      expect(result.current.trusted).toBe(true);
    });

    it('is trusted when saved data is corrupt (a successful read of unusable data)', async () => {
      await AsyncStorage.setItem(KEY, '{oops');
      const { result } = await setup();
      expect(result.current.trusted).toBe(true);
    });

    it('is ready but not trusted, and never saves, when the read fails', async () => {
      const saved = { profiles: [{ id: 'a', ...input('Ana') }], activeId: 'a' };
      await AsyncStorage.setItem(KEY, JSON.stringify(saved));
      jest.mocked(AsyncStorage.setItem).mockClear();
      jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => Promise.reject(new Error('disk')));

      const { result } = await setup();
      expect(result.current.trusted).toBe(false);
      expect(result.current.profiles).toEqual([]);

      await act(async () => {
        result.current.createProfile(input('Mia'));
      });

      expect(result.current.profiles).toHaveLength(1);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      expect(await persisted()).toEqual(saved);
    });
  });
});
