import { act, renderHook } from '@testing-library/react-native';
import { setAudioModeAsync } from 'expo-audio';
import type { ReactNode } from 'react';
import { makeStory } from '../test/fixtures';
import { ASSET_BASE_URL } from './catalog';
import { PlayerProvider, usePlayer } from './PlayerProvider';

const mockPlayer = {
  playing: false,
  play: jest.fn(),
  pause: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setActiveForLockScreen: jest.fn(),
  clearLockScreenControls: jest.fn(),
  setPlaybackRate: jest.fn(),
  volume: 1,
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

let mockActiveId: string | null = 'k1';
jest.mock('./ProfilesProvider', () => ({ useProfiles: () => ({ activeId: mockActiveId }) }));

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
  mockPlayer.volume = 1;
  mockActiveId = 'k1';
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
      expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: `${ASSET_BASE_URL}/audio/sleepy-moon.mp3` });
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

    it('does not reload the same story when play is called twice before a re-render', async () => {
      const { result } = await setup();

      await act(async () => {
        result.current.play(story);
        result.current.play(story);
      });

      expect(mockPlayer.replace).toHaveBeenCalledTimes(1);
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

  describe('play result', () => {
    it('returns true on success', async () => {
      const { result } = await setup();
      let ok: boolean | undefined;

      await act(async () => {
        ok = result.current.play(story);
      });

      expect(ok).toBe(true);
    });

    it('returns false and sets error when the player throws', async () => {
      mockPlayer.replace.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const { result } = await setup();
      let ok: boolean | undefined;

      await act(async () => {
        ok = result.current.play(story);
      });

      expect(ok).toBe(false);
      expect(result.current.error).toMatch(/Could not load this story/);
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

  describe('finishCount', () => {
    it('increments once when a story finishes', async () => {
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));
      expect(result.current.finishCount).toBe(0);

      setStatus({ currentTime: 300, didJustFinish: true });
      await rerender({});
      await rerender({});

      expect(result.current.finishCount).toBe(1);
    });

    it("increments again for the next story's finish", async () => {
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));
      setStatus({ didJustFinish: true });
      await rerender({});
      setStatus({ didJustFinish: false });
      await rerender({});
      await act(async () => result.current.play(makeStory({ id: 'story-2' })));

      setStatus({ didJustFinish: true });
      await rerender({});

      expect(result.current.finishCount).toBe(2);
    });
  });

  describe('playback speed', () => {
    it('defaults to 1x', async () => {
      const { result } = await setup();
      expect(result.current.playbackRate).toBe(1);
    });

    it('sets the player rate and reports it', async () => {
      const { result } = await setup();

      await act(async () => result.current.setPlaybackRate(1.25));

      expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1.25);
      expect(result.current.playbackRate).toBe(1.25);
    });

    it('resets to 1x when a different story starts', async () => {
      const { result } = await setup();
      await act(async () => result.current.play(story));
      await act(async () => result.current.setPlaybackRate(0.75));
      mockPlayer.setPlaybackRate.mockClear();

      await act(async () => result.current.play(makeStory({ id: 'other', audio: 'audio/other.mp3' })));

      expect(result.current.playbackRate).toBe(1);
      expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1);
    });

    it('keeps the rate when the current story is played again', async () => {
      const { result } = await setup();
      await act(async () => result.current.play(story));
      await act(async () => result.current.setPlaybackRate(1.25));

      await act(async () => result.current.play(story));

      expect(result.current.playbackRate).toBe(1.25);
    });
  });

  describe('pause', () => {
    it('pauses even when the native player has not reported playing yet', async () => {
      const { result } = await setup();

      await act(async () => result.current.pause());

      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
      expect(mockPlayer.play).not.toHaveBeenCalled();
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

    it('increments sleepExpiredCount when the timer reaches zero', async () => {
      const { result } = await setup();
      await act(async () => result.current.setSleepTimer(10));
      expect(result.current.sleepExpiredCount).toBe(0);

      await act(async () => jest.advanceTimersByTime(10 * 60_000 + 1000));

      expect(result.current.sleepExpiredCount).toBe(1);
    });

    it('leaves sleepExpiredCount alone when the timer is cleared early', async () => {
      const { result } = await setup();
      await act(async () => result.current.setSleepTimer(10));

      await act(async () => result.current.setSleepTimer(null));
      await act(async () => jest.advanceTimersByTime(10 * 60_000 + 1000));

      expect(result.current.sleepExpiredCount).toBe(0);
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

    describe('fadeOutAndPause', () => {
      it('lowers the volume over the last 10 seconds then pauses at the end time', async () => {
        setStatus({ playing: true });
        const { result } = await setup();
        await act(async () => result.current.fadeOutAndPause(Date.now() + 30_000));

        await act(async () => jest.advanceTimersByTime(15_000));
        expect(mockPlayer.volume).toBe(1);

        await act(async () => jest.advanceTimersByTime(10_000));
        expect(mockPlayer.volume).toBeCloseTo(0.5, 1);
        expect(mockPlayer.pause).not.toHaveBeenCalled();

        await act(async () => jest.advanceTimersByTime(6_000));
        expect(mockPlayer.pause).toHaveBeenCalled();
      });

      it('pauses on the next tick when the end time is already past', async () => {
        const { result } = await setup();

        await act(async () => result.current.fadeOutAndPause(Date.now() - 5_000));
        await act(async () => jest.advanceTimersByTime(1_000));

        expect(mockPlayer.pause).toHaveBeenCalled();
      });

      it('replaces a running sleep timer', async () => {
        const { result } = await setup();
        await act(async () => result.current.setSleepTimer(20));

        await act(async () => result.current.fadeOutAndPause(Date.now() + 5_000));

        expect(result.current.sleepMinutes).toBeNull();
        expect(result.current.sleepRemainingSec).toBe(5);
        await act(async () => jest.advanceTimersByTime(6_000));
        expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
      });

      it('restores full volume after the pause', async () => {
        setStatus({ playing: true });
        const { result } = await setup();
        await act(async () => result.current.fadeOutAndPause(Date.now() + 12_000));

        await act(async () => jest.advanceTimersByTime(13_000));

        expect(mockPlayer.pause).toHaveBeenCalled();
        expect(mockPlayer.volume).toBe(1);
      });
    });

    describe('fade-out', () => {
      const startTimerAtFade = async (elapsedMs: number) => {
        setStatus({ playing: true });
        const utils = await setup();
        await act(async () => utils.result.current.setSleepTimer(1));
        await act(async () => jest.advanceTimersByTime(elapsedMs));
        return utils;
      };

      it('keeps full volume until 10 seconds remain', async () => {
        await startTimerAtFade(49_000);

        expect(mockPlayer.volume).toBe(1);
      });

      it('ramps the volume down linearly over the final 10 seconds', async () => {
        await startTimerAtFade(55_000);

        expect(mockPlayer.volume).toBeCloseTo(0.5, 1);
      });

      it('pauses and restores full volume when the timer ends', async () => {
        await startTimerAtFade(61_000);

        expect(mockPlayer.pause).toHaveBeenCalled();
        expect(mockPlayer.volume).toBe(1);
      });

      it('restores volume when playback is paused mid-fade', async () => {
        const { rerender } = await startTimerAtFade(55_000);

        setStatus({ playing: false });
        await rerender({});

        expect(mockPlayer.volume).toBe(1);
      });

      it('restores volume when a new story starts mid-fade', async () => {
        const { result } = await startTimerAtFade(55_000);

        await act(async () => result.current.play(story));

        expect(mockPlayer.volume).toBe(1);
      });

      it('restores volume when the timer is cleared mid-fade', async () => {
        const { result } = await startTimerAtFade(55_000);

        await act(async () => result.current.setSleepTimer(null));

        expect(mockPlayer.volume).toBe(1);
      });

      it('restores volume when the timer is replaced mid-fade', async () => {
        const { result } = await startTimerAtFade(55_000);

        await act(async () => result.current.setSleepTimer(20));

        expect(mockPlayer.volume).toBe(1);
      });

      it('clears the timer and restores volume when the profile changes mid-fade', async () => {
        const { result, rerender } = await startTimerAtFade(55_000);

        mockActiveId = 'k2';
        await rerender({});

        expect(result.current.sleepMinutes).toBeNull();
        expect(result.current.sleepRemainingSec).toBeNull();
        expect(mockPlayer.volume).toBe(1);
      });

      it('restores volume when the provider unmounts mid-fade', async () => {
        const { unmount } = await startTimerAtFade(55_000);

        await unmount();

        expect(mockPlayer.volume).toBe(1);
      });
    });
  });

  describe('profile switch', () => {
    it('stops playback and never writes progress or completion into the new profile', async () => {
      setStatus({ playing: true, currentTime: 42 });
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));
      mockPlayer.pause.mockClear();
      mockLibrary.saveProgress.mockClear();

      mockActiveId = 'k2';
      await rerender({});

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(mockPlayer.clearLockScreenControls).toHaveBeenCalled();
      expect(result.current.current).toBeNull();

      await act(async () => jest.advanceTimersByTime(15_000));
      setStatus({ playing: false, currentTime: 50 });
      await rerender({});
      setStatus({ playing: false, currentTime: 300, didJustFinish: true });
      await rerender({});

      expect(mockLibrary.saveProgress).not.toHaveBeenCalled();
      expect(mockLibrary.markCompleted).not.toHaveBeenCalled();
    });

    it('does not stop anything on mount or when the active profile is unchanged', async () => {
      setStatus({ playing: true, currentTime: 42 });
      const { result, rerender } = await setup();
      await act(async () => result.current.play(story));

      await rerender({});

      expect(mockPlayer.pause).not.toHaveBeenCalled();
      expect(mockPlayer.clearLockScreenControls).not.toHaveBeenCalled();
      expect(result.current.current).toEqual(story);
    });
  });
});
