import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { BEDTIME_KEY, serializeSession } from './bedtime';
import { BedtimeProvider, useBedtime } from './BedtimeProvider';

const mockPlayer = { isPlaying: false, pause: jest.fn(), fadeOutAndPause: jest.fn() };
jest.mock('./PlayerProvider', () => ({ usePlayer: () => mockPlayer }));

const NOW = 1_700_000_000_000;
const wrapper = ({ children }: { children: ReactNode }) => <BedtimeProvider>{children}</BedtimeProvider>;

let appStateHandler: ((state: AppStateStatus) => void) | null = null;
const removeListener = jest.fn();

async function setup(stored?: string) {
  if (stored !== undefined) await AsyncStorage.setItem(BEDTIME_KEY, stored);
  const hook = await renderHook(() => useBedtime(), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  mockPlayer.isPlaying = false;
  appStateHandler = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler;
    return { remove: removeListener };
  });
  await AsyncStorage.clear();
  jest.mocked(AsyncStorage.setItem).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useBedtime', () => {
  it('throws outside of BedtimeProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useBedtime())).rejects.toThrow('useBedtime must be used inside BedtimeProvider');
    spy.mockRestore();
  });

  it('starts inactive when nothing is stored', async () => {
    const { result } = await setup();

    expect(result.current).toMatchObject({ active: false, locked: false, remainingSec: null });
  });

  it('restores an active session from storage', async () => {
    const { result } = await setup(serializeSession(NOW + 600_000));

    expect(result.current).toMatchObject({ active: true, locked: false, remainingSec: 600 });
  });

  it('opens locked, without touching playback, when the stored session has already expired', async () => {
    const { result } = await setup(serializeSession(NOW - 1000));

    expect(result.current).toMatchObject({ active: true, locked: true });
    expect(mockPlayer.fadeOutAndPause).not.toHaveBeenCalled();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
  });

  it('treats a corrupt stored value as no session', async () => {
    const { result } = await setup('{garbage');

    expect(result.current).toMatchObject({ active: false, locked: false });
  });

  it('startBedtime persists the end time and counts the remaining seconds down', async () => {
    const { result } = await setup();

    await act(async () => result.current.startBedtime(15));
    expect(result.current).toMatchObject({ active: true, remainingSec: 900 });
    expect(await AsyncStorage.getItem(BEDTIME_KEY)).toBe(serializeSession(NOW + 15 * 60_000));

    await act(async () => jest.advanceTimersByTime(60_000));
    expect(result.current.remainingSec).toBe(840);
  });

  it('asks the player to fade out when 10 seconds remain and locks at the end time', async () => {
    const { result } = await setup();
    await act(async () => result.current.startBedtime(1));

    await act(async () => jest.advanceTimersByTime(49_000));
    expect(mockPlayer.fadeOutAndPause).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(1_500));
    expect(mockPlayer.fadeOutAndPause).toHaveBeenCalledWith(NOW + 60_000);
    expect(result.current.locked).toBe(false);

    await act(async () => jest.advanceTimersByTime(10_000));
    expect(result.current.locked).toBe(true);
  });

  it('locks at the end time even when nothing is playing', async () => {
    const { result } = await setup();
    await act(async () => result.current.startBedtime(1));

    await act(async () => jest.advanceTimersByTime(61_000));

    expect(result.current.locked).toBe(true);
    expect(mockPlayer.pause).not.toHaveBeenCalled();
  });

  it('locks when the app becomes active after the end time passed in the background', async () => {
    const { result } = await setup();
    await act(async () => result.current.startBedtime(1));

    jest.setSystemTime(NOW + 120_000);
    await act(async () => appStateHandler?.('active'));

    expect(result.current.locked).toBe(true);
  });

  it('replaces a running session when a new one starts', async () => {
    const { result } = await setup();
    await act(async () => result.current.startBedtime(15));

    await act(async () => result.current.startBedtime(30));

    expect(result.current.remainingSec).toBe(1800);
    expect(await AsyncStorage.getItem(BEDTIME_KEY)).toBe(serializeSession(NOW + 30 * 60_000));
  });

  it('endBedtime clears the session and storage', async () => {
    const { result } = await setup(serializeSession(NOW - 1000));

    await act(async () => result.current.endBedtime());

    expect(result.current).toMatchObject({ active: false, locked: false, remainingSec: null });
    expect(await AsyncStorage.getItem(BEDTIME_KEY)).toBeNull();
  });

  it('pauses (never toggles) if playback starts while locked', async () => {
    const { result, rerender } = await setup(serializeSession(NOW - 1000));
    expect(result.current.locked).toBe(true);

    mockPlayer.isPlaying = true;
    await rerender({});

    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('removes its app state listener on unmount', async () => {
    const { result, unmount } = await setup();
    await act(async () => result.current.startBedtime(15));

    await unmount();

    expect(removeListener).toHaveBeenCalled();
  });
});
