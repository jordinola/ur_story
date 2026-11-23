import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import EditProfileScreen from '../app/profiles/edit';
import ProfilesScreen from '../app/profiles/index';
import { ProfilesProvider, useProfiles } from '../lib/ProfilesProvider';
import type { ProfileInput } from '../types';

const mockParams: { id?: string } = {};

jest.mock('expo-router', () => {
  const Stack = Object.assign(
    function Stack() {
      return null;
    },
    { Screen: function Screen() { return null; } },
  );
  return {
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: () => mockParams,
    Stack,
  };
});

const input = (name: string): ProfileInput => ({ name, age: 5, tags: [], languages: ['en'], color: '#1D4ED8' });

const probe: { current: ReturnType<typeof useProfiles> | null } = { current: null };
function Probe() {
  const value = useProfiles();
  useEffect(() => {
    probe.current = value;
  });
  return null;
}

const renderWithProvider = async (ui: React.ReactElement) => {
  await render(
    <ProfilesProvider>
      <Probe />
      {ui}
    </ProfilesProvider>,
  );
  await act(async () => {});
};

const store = (names: string[]) =>
  AsyncStorage.setItem(
    'storytime:profiles:v1',
    JSON.stringify({
      profiles: names.map((n, i) => ({ ...input(n), id: `id-${i}` })),
      activeId: 'id-0',
    }),
  );

const seed = async (names: string[]) => {
  await act(async () => {
    names.forEach((n) => probe.current!.createProfile(input(n)));
  });
};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  await AsyncStorage.clear();
  delete mockParams.id;
});

describe('ProfilesScreen', () => {
  it('shows an empty state with an add button', async () => {
    await renderWithProvider(<ProfilesScreen />);
    expect(screen.getByRole('button', { name: 'Add a profile' })).toBeOnTheScreen();
  });

  it('lists profiles with edit and add', async () => {
    await renderWithProvider(<ProfilesScreen />);
    await seed(['Mia', 'Leo']);
    expect(screen.getByText('Mia')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Edit Leo' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/profiles/edit', params: { id: probe.current!.profiles[1]?.id } });
    await fireEvent.press(screen.getByRole('button', { name: 'Add a profile' }));
    expect(router.push).toHaveBeenCalledWith('/profiles/edit');
  });

  it('disables add with a message at 6 profiles', async () => {
    await renderWithProvider(<ProfilesScreen />);
    await seed(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(screen.getByRole('button', { name: 'Add a profile' })).toBeDisabled();
    expect(screen.getByText(/up to 6 profiles/i)).toBeOnTheScreen();
  });

  it('removes a deleted active profile from the list', async () => {
    await renderWithProvider(<ProfilesScreen />);
    await seed(['Mia', 'Leo']);
    expect(probe.current!.activeProfile?.name).toBe('Leo');
    await act(async () => probe.current!.deleteProfile(probe.current!.profiles[1]!.id));
    expect(screen.queryByText('Leo')).toBeNull();
    expect(screen.getByText('Mia')).toBeOnTheScreen();
  });

  it('warns and disables add when profiles could not be loaded', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    await renderWithProvider(<ProfilesScreen />);
    expect(await screen.findByText(/couldn.t be loaded/i)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add a profile' })).toBeDisabled();
  });
});

describe('EditProfileScreen', () => {
  it('creates a profile, makes it active and goes back', async () => {
    await renderWithProvider(<EditProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Zoe');
    await fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));
    expect(probe.current!.activeProfile?.name).toBe('Zoe');
    expect(router.back).toHaveBeenCalled();
  });

  it('updates an existing profile and goes back', async () => {
    await store(['Mia']);
    mockParams.id = 'id-0';
    await renderWithProvider(<EditProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Mimi');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    expect(probe.current!.profiles[0]?.name).toBe('Mimi');
    expect(router.back).toHaveBeenCalled();
  });

  it('shows a friendly not-found state for an unknown id', async () => {
    mockParams.id = 'nope';
    await renderWithProvider(<EditProfileScreen />);
    expect(screen.getByText('Profile not found')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('leaves to home after saving when opened cold from a deep link', async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await renderWithProvider(<EditProfileScreen />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Zoe');
    await fireEvent.press(screen.getByRole('button', { name: 'Add profile' }));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('leaves to home from the not-found Back when opened cold from a deep link', async () => {
    jest.mocked(router.canGoBack).mockReturnValue(false);
    mockParams.id = 'nope';
    await renderWithProvider(<EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('deletes after confirmation and goes back', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await store(['Mia']);
    mockParams.id = 'id-0';
    await renderWithProvider(<EditProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete profile' }));
    await act(async () => alert.mock.calls[0]?.[2]?.find((b) => b.style === 'destructive')?.onPress?.());
    expect(probe.current!.profiles).toHaveLength(0);
    expect(router.back).toHaveBeenCalled();
    expect(screen.queryByText('Profile not found')).toBeNull();
  });

  it('does not allow saving when profiles could not be loaded', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    await renderWithProvider(<EditProfileScreen />);
    expect(await screen.findByText(/couldn.t be loaded/i)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Add profile' })).toBeDisabled();
  });
});
