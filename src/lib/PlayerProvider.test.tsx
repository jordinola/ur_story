import { act, renderHook } from '@testing-library/react-native';
import { setAudioModeAsync } from 'expo-audio';
import type { ReactNode } from 'react';
import { makeStory } from '../test/fixtures';
import { PlayerProvider, usePlayer } from './PlayerProvider';

const mockPlayer = {
  playing: false,
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setActiveForLockScreen: jest.fn(),
};

let mockStatus = {
  isLoaded: false,
  isBuffering: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  didJustFinish: false,
};

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));

const mockLibrary = {
  saveProgress: jest.fn(),
  markCompleted: jest.fn(),
  getProgress: jest.fn((_id: string) => 0),
};
jest.mock('./LibraryProvider', () => ({ useLibrary: () => mockLibrary }));

const wrapper = ({ children }: { children: ReactNode }) => <PlayerProvider>{children}</PlayerProvider>;

const story = makeStory();

function setStatus(patch: Partial<typeof mockStatus>) {
  mockStatus = { ...mockStatus, ...patch };
}

async function setup() {
  return renderHook(() => usePlayer(), { wrapper });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPlayer.playing = false;
  mockLibrary.getProgress.mockReturnValue(0);
  mockStatus = {
    isLoaded: false,
    isBuffering: false,
    playing: false,
    currentTime: 0,
    duration: 0,
    didJustFinish: false,
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePlayer', () => {
  it('throws outside of PlayerProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => usePlayer())).rejects.toThrow(
      'usePlayer must be used inside PlayerProvider',
    );
    spy.mockRestore();
  });
});

describe('PlayerProvider', () => {
  it('starts idle', async () => {
    const { result } = await setup();

    expect(result.current.current).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.sleepMinutes).toBeNull();
  });

  it('configures background playback and silent-mode audio on mount', async () => {
    await setup();

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  });

  describe('play', () => {
    it('loads the story, enables lock-screen controls and plays', async () => {
      const { result } = await setup();

      await act(async () => result.current.play(story));

      expect(result.current.current).toEqual(story);
      expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: '/audio/sleepy-moon.mp3' });
      expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ title: story.title }),
      );
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('uses the story duration while the audio is still loading', async () => {
      const { result } = await setup();

      await act(async () => result.current.play(story));

      expect(result.current.duration).toBe(story.durationSec);
      expect(result.current.isLoading).toBe(true);
    });

    it('resumes a paused story without reloading it', async () => {
      const { result } = await setup();
      await act(async () => result.current.play(story));
      mockPlayer.replace.mockClear();
      mockPlayer.play.mockClear();

      await act(async () => result.current.play(story));

      expect(mockPlayer.replace).not.toHaveBeenCalled();
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the story is already playing', async () => {
      const { result } = await setup();
      await act(async () => result.current.play(story));
      mockPlayer.play.mockClear();
      mockPlayer.playing = true;

      await act(async () => result.current.play(story));

      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it('seeks to the saved position once the audio has loaded', async () => {
      mockLibrary.getProgress.mockReturnValue(75);
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));
      expect(mockPlayer.seekTo).not.toHaveBeenCalled();

      setStatus({ isLoaded: true });
      await rerender({});

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(75);
    });

    it('ignores saved positions of 3 seconds or less', async () => {
      mockLibrary.getProgress.mockReturnValue(3);
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));

      setStatus({ isLoaded: true });
      await rerender({});

      expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    });

    it('exposes an error when the player fails to load', async () => {
      mockPlayer.replace.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const { result } = await setup();

      await act(async () => result.current.play(story));

      expect(result.current.error).toMatch(/Could not load this story/);
    });

    it('clears the previous error when a new story is played', async () => {
      mockPlayer.replace.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const { result } = await setup();
      await act(async () => result.current.play(story));

      await act(async () => result.current.play(makeStory({ id: 'story-2' })));

      expect(result.current.error).toBeNull();
    });
  });

  describe('toggle', () => {
    it('pauses when playing', async () => {
      const { result } = await setup();
      mockPlayer.playing = true;

      await act(async () => result.current.toggle());

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(mockPlayer.play).not.toHaveBeenCalled();
    });

    it('plays when paused', async () => {
      const { result } = await setup();

      await act(async () => result.current.toggle());

      expect(mockPlayer.play).toHaveBeenCalled();
    });
  });

  describe('seeking', () => {
    it('seekTo clamps negative positions to zero', async () => {
      const { result } = await setup();

      await act(async () => result.current.seekTo(-10));

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    });

    it('seekBy moves relative to the current position', async () => {
      setStatus({ currentTime: 100, duration: 300 });
      const { result } = await setup();

      await act(async () => result.current.seekBy(15));
      await act(async () => result.current.seekBy(-15));

      expect(mockPlayer.seekTo).toHaveBeenNthCalledWith(1, 115);
      expect(mockPlayer.seekTo).toHaveBeenNthCalledWith(2, 85);
    });

    it('seekBy does not go past the end', async () => {
      setStatus({ currentTime: 295, duration: 300 });
      const { result } = await setup();

      await act(async () => result.current.seekBy(15));

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(300);
    });

    it('seekBy does not go before the start', async () => {
      setStatus({ currentTime: 5, duration: 300 });
      const { result } = await setup();

      await act(async () => result.current.seekBy(-15));

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    });
  });

  describe('progress persistence', () => {
    it('saves progress every 5 seconds while playing', async () => {
      setStatus({ playing: true, currentTime: 42 });
      const { result } = await setup();
      await act(async () => result.current.play(story));
      mockLibrary.saveProgress.mockClear();

      await act(async () => jest.advanceTimersByTime(5000));

      expect(mockLibrary.saveProgress).toHaveBeenCalledWith(story.id, 42);
    });

    it('saves progress when playback pauses', async () => {
      setStatus({ playing: true, currentTime: 20 });
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));
      mockLibrary.saveProgress.mockClear();

      setStatus({ playing: false, currentTime: 20 });
      await rerender({});

      expect(mockLibrary.saveProgress).toHaveBeenCalledWith(story.id, 20);
    });

    it('marks the story completed when it finishes, without saving progress', async () => {
      setStatus({ playing: true, currentTime: 299 });
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));
      mockLibrary.saveProgress.mockClear();

      setStatus({ playing: false, currentTime: 300, didJustFinish: true });
      await rerender({});

      expect(mockLibrary.markCompleted).toHaveBeenCalledWith(story.id);
      expect(mockLibrary.saveProgress).not.toHaveBeenCalled();
    });
  });

  describe('sleep timer', () => {
    it('counts down and reports remaining seconds', async () => {
      const { result } = await setup();

      await act(async () => result.current.setSleepTimer(10));
      expect(result.current.sleepMinutes).toBe(10);
      expect(result.current.sleepRemainingSec).toBe(600);

      await act(async () => jest.advanceTimersByTime(60_000));
      expect(result.current.sleepRemainingSec).toBe(540);
    });

    it('pauses playback and resets when the timer elapses', async () => {
      const { result } = await setup();
      await act(async () => result.current.setSleepTimer(10));

      await act(async () => jest.advanceTimersByTime(10 * 60_000 + 1000));

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(result.current.sleepMinutes).toBeNull();
      expect(result.current.sleepRemainingSec).toBeNull();
    });

    it('can be cancelled', async () => {
      const { result } = await setup();
      await act(async () => result.current.setSleepTimer(20));

      await act(async () => result.current.setSleepTimer(null));
      await act(async () => jest.advanceTimersByTime(20 * 60_000 + 1000));

      expect(result.current.sleepMinutes).toBeNull();
      expect(result.current.sleepRemainingSec).toBeNull();
      expect(mockPlayer.pause).not.toHaveBeenCalled();
    });
  });
});
