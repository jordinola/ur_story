import { act, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { makeStory } from '../test/fixtures';
import { SPLASH_TIMEOUT_MS, SplashGate } from './SplashGate';

const mockLibrary = { ready: false, stories: [] as ReturnType<typeof makeStory>[] };

jest.mock('../lib/LibraryProvider', () => ({ useLibrary: () => mockLibrary }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockLibrary.ready = false;
  mockLibrary.stories = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SplashGate', () => {
  it('keeps the splash screen while the library is still loading', async () => {
    await render(<SplashGate />);

    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('keeps the splash screen until stories are available', async () => {
    mockLibrary.ready = true;
    await render(<SplashGate />);

    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('hides the splash screen once the library is ready with stories', async () => {
    mockLibrary.ready = true;
    mockLibrary.stories = [makeStory()];
    await render(<SplashGate />);

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('hides the splash screen once loading finishes after the first render', async () => {
    const { rerender } = await render(<SplashGate />);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();

    mockLibrary.ready = true;
    mockLibrary.stories = [makeStory()];
    await rerender(<SplashGate />);

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('never traps the user on the splash screen if loading stalls', async () => {
    await render(<SplashGate />);

    await act(async () => {
      jest.advanceTimersByTime(SPLASH_TIMEOUT_MS);
    });

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('clears the fallback timer on unmount', async () => {
    const { unmount } = await render(<SplashGate />);

    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(SPLASH_TIMEOUT_MS * 2);
    });

    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });
});
