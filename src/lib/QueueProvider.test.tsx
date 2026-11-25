import { act, renderHook } from '@testing-library/react-native';
import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { makeStory } from '../test/fixtures';
import type { Story } from '../types';
import { GAP_SEC, QueueProvider, useQueue } from './QueueProvider';

type MockPlayer = {
  current: Story | null;
  isPlaying: boolean;
  position: number;
  play: jest.Mock<boolean | undefined, [Story, { fromStart?: boolean }?]>;
  replay: jest.Mock<void, []>;
  seekTo: jest.Mock<void, [number]>;
  finishCount: number;
  sleepExpiredCount: number;
};

const mockPlayer: MockPlayer = {
  current: null,
  isPlaying: false,
  position: 0,
  play: jest.fn(),
  replay: jest.fn(),
  seekTo: jest.fn(),
  finishCount: 0,
  sleepExpiredCount: 0,
};
const mockBedtime = { locked: false };
const mockProfiles: { activeId: string | null } = { activeId: 'kid-1' };

jest.mock('./PlayerProvider', () => ({ usePlayer: () => mockPlayer }));
jest.mock('./BedtimeProvider', () => ({ useBedtime: () => mockBedtime }));
jest.mock('./ProfilesProvider', () => ({ useProfiles: () => mockProfiles }));
jest.mock('expo-router', () => ({
  router: { setParams: jest.fn() },
  usePathname: jest.fn(() => '/'),
}));

const A = makeStory({ id: 'a', title: 'A' });
const B = makeStory({ id: 'b', title: 'B' });
const C = makeStory({ id: 'c', title: 'C' });

const wrapper = ({ children }: { children: ReactNode }) => <QueueProvider>{children}</QueueProvider>;

let appStateHandler: ((state: AppStateStatus) => void) | null = null;
// The jest preset auto-mocks `currentState` as a function; give it a plain value per test.
const originalCurrentState = Object.getOwnPropertyDescriptor(AppState, 'currentState');
const setAppState = (state: AppStateStatus) =>
  Object.defineProperty(AppState, 'currentState', { value: state, writable: true, configurable: true });

async function setup() {
  const hook = await renderHook(() => useQueue(), { wrapper });
  const rerender = () => hook.rerender(undefined);
  const finish = async () => {
    mockPlayer.finishCount += 1;
    await rerender();
  };
  const tick = (ms: number) => act(async () => jest.advanceTimersByTime(ms));
  return { ...hook, rerender, finish, tick };
}

/** Story A is playing, B and C are queued. */
async function setupPlayingAWithBAndC() {
  mockPlayer.current = A;
  mockPlayer.isPlaying = true;
  const hook = await setup();
  await act(async () => {
    hook.result.current.enqueue(B);
    hook.result.current.enqueue(C);
  });
  mockPlayer.isPlaying = false;
  return hook;
}

const ids = (stories: Story[]) => stories.map((s) => s.id);

/** A played, then B started: history is [A] and B is current. */
async function setupPlayingBAfterA() {
  mockPlayer.current = A;
  const hook = await setup();
  mockPlayer.current = B;
  await hook.rerender();
  return hook;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPlayer.current = null;
  mockPlayer.isPlaying = false;
  mockPlayer.position = 0;
  mockPlayer.finishCount = 0;
  mockPlayer.sleepExpiredCount = 0;
  mockPlayer.play.mockImplementation(() => true);
  mockBedtime.locked = false;
  mockProfiles.activeId = 'kid-1';
  jest.mocked(usePathname).mockReturnValue('/');
  appStateHandler = null;
  setAppState('active');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  if (originalCurrentState) Object.defineProperty(AppState, 'currentState', originalCurrentState);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useQueue', () => {
  it('throws outside of QueueProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useQueue())).rejects.toThrow('useQueue must be used inside QueueProvider');
    spy.mockRestore();
  });

  it('removes the AppState subscription on unmount', async () => {
    const remove = jest.fn();
    jest.mocked(AppState.addEventListener).mockReturnValue({ remove });
    const { unmount } = await setup();

    await unmount();

    expect(remove).toHaveBeenCalled();
  });

  it('enqueue ignores the story that is playing', async () => {
    mockPlayer.current = A;
    const { result } = await setup();

    await act(async () => {
      result.current.enqueue(A);
      result.current.playNext(A);
      result.current.enqueue(B);
    });

    expect(ids(result.current.queue)).toEqual(['b']);
  });

  it('playNext, moveToTop, remove and clear edit the queue', async () => {
    const { result } = await setup();

    await act(async () => {
      result.current.enqueue(A);
      result.current.enqueue(B);
      result.current.playNext(C);
    });
    expect(ids(result.current.queue)).toEqual(['c', 'a', 'b']);

    await act(async () => result.current.moveToTop('b'));
    expect(ids(result.current.queue)).toEqual(['b', 'c', 'a']);

    await act(async () => result.current.remove('c'));
    expect(ids(result.current.queue)).toEqual(['b', 'a']);

    await act(async () => result.current.clear());
    expect(result.current.queue).toEqual([]);
  });

  it('advances to the next story after the gap', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    expect(result.current.upNext).toEqual(B);
    expect(result.current.gapRemainingSec).toBe(GAP_SEC);

    await tick(1000);
    expect(result.current.gapRemainingSec).toBe(GAP_SEC - 1);
    expect(mockPlayer.play).not.toHaveBeenCalled();

    await tick((GAP_SEC - 1) * 1000);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(ids(result.current.queue)).toEqual(['c']);
    expect(result.current.upNext).toBeNull();
    expect(result.current.gapRemainingSec).toBeNull();
  });

  it('does nothing on a finish when the queue is empty', async () => {
    mockPlayer.current = A;
    const { result, finish, tick } = await setup();

    await finish();
    await tick(GAP_SEC * 1000);

    expect(result.current.upNext).toBeNull();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('starts immediately when the app is in the background', async () => {
    const { result, finish } = await setupPlayingAWithBAndC();
    setAppState('background');

    await finish();

    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(result.current.upNext).toBeNull();
    expect(ids(result.current.queue)).toEqual(['c']);
  });

  it('starts at once when the app goes to the background during the gap', async () => {
    const { result, finish } = await setupPlayingAWithBAndC();

    await finish();
    expect(result.current.upNext).toEqual(B);
    await act(async () => appStateHandler?.('background'));

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(result.current.upNext).toBeNull();
  });

  it('keeps counting when the app only goes inactive during the gap', async () => {
    const { result, finish } = await setupPlayingAWithBAndC();

    await finish();
    await act(async () => appStateHandler?.('inactive'));

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toEqual(B);
  });

  it('cancelUpNext keeps the queue and starts nothing', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await act(async () => result.current.cancelUpNext());
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
    expect(result.current.gapRemainingSec).toBeNull();
    expect(ids(result.current.queue)).toEqual(['b', 'c']);
  });

  it('playing anything during the gap cancels it', async () => {
    const { result, finish, rerender, tick } = await setupPlayingAWithBAndC();

    await finish();
    mockPlayer.isPlaying = true;
    await rerender();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
    expect(ids(result.current.queue)).toEqual(['b', 'c']);
  });

  it('a different current story during the gap cancels it', async () => {
    const other = makeStory({ id: 'other' });
    const { result, finish, rerender, tick } = await setupPlayingAWithBAndC();

    await finish();
    mockPlayer.current = other;
    await rerender();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
    expect(ids(result.current.queue)).toEqual(['b', 'c']);
  });

  it('does not advance when bedtime is locked', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();
    mockBedtime.locked = true;

    await finish();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
  });

  it('does not advance when bedtime locks during the gap', async () => {
    const { result, finish, rerender, tick } = await setupPlayingAWithBAndC();

    await finish();
    mockBedtime.locked = true;
    await rerender();
    await tick(GAP_SEC * 1000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
    expect(result.current.gapRemainingSec).toBeNull();
  });

  it('does not advance and clears upNext when the sleep timer expired during the gap', async () => {
    const { result, finish, rerender, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(2000);
    mockPlayer.sleepExpiredCount += 1;
    await rerender();

    expect(result.current.upNext).toBeNull();
    expect(result.current.gapRemainingSec).toBeNull();
    await tick(GAP_SEC * 1000);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('a finish in the same tick as an expiry does not advance', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    mockPlayer.sleepExpiredCount += 1;
    await finish();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
  });

  it('a finish in the same tick as an expiry does not advance in the background either', async () => {
    const { finish } = await setupPlayingAWithBAndC();
    setAppState('background');

    mockPlayer.sleepExpiredCount += 1;
    await finish();

    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('a queued story playing by hand leaves the queue', async () => {
    const { result, rerender } = await setupPlayingAWithBAndC();

    mockPlayer.current = C;
    await rerender();

    expect(ids(result.current.queue)).toEqual(['b']);
  });

  it('a queued head equal to the finished story is dropped and the next one plays', async () => {
    const { result, finish, tick } = await setup();
    await act(async () => {
      result.current.enqueue(A);
      result.current.enqueue(B);
    });

    // A starts and finishes in the same render, so the finish handler must drop it itself.
    mockPlayer.current = A;
    await finish();
    expect(result.current.upNext).toEqual(B);
    await tick(GAP_SEC * 1000);

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(result.current.queue).toEqual([]);
  });

  it('a second finishCount bump while a gap is counting does not start two stories', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(2000);
    await finish();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(ids(result.current.queue)).toEqual(['c']);
  });

  it('profile switch cancels the gap and empties the queue', async () => {
    const { result, finish, rerender, tick } = await setupPlayingAWithBAndC();

    await finish();
    mockProfiles.activeId = 'kid-2';
    await rerender();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
    expect(result.current.gapRemainingSec).toBeNull();
    expect(result.current.queue).toEqual([]);
  });

  it('play returning false skips to the next queued story', async () => {
    mockPlayer.play.mockImplementation((story) => story.id !== 'b');
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(GAP_SEC * 1000);

    expect(mockPlayer.play.mock.calls.map(([s]) => s.id)).toEqual(['b', 'c']);
    expect(result.current.queue).toEqual([]);
  });

  it('play returning false with nothing left stops', async () => {
    mockPlayer.play.mockImplementation(() => false);
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(GAP_SEC * 1000);

    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
    expect(result.current.queue).toEqual([]);
    expect(result.current.upNext).toBeNull();
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('treats a play that returns undefined as started', async () => {
    mockPlayer.play.mockImplementation(() => undefined);
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(GAP_SEC * 1000);

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(ids(result.current.queue)).toEqual(['c']);
  });

  it('updates the route param after advancing on a story screen', async () => {
    jest.mocked(usePathname).mockReturnValue('/story/a');
    const { finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(GAP_SEC * 1000);

    expect(router.setParams).toHaveBeenCalledWith({ id: 'b' });
  });

  it('leaves the route alone after advancing elsewhere', async () => {
    const { finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(GAP_SEC * 1000);

    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('playNextNow starts the head of the queue immediately', async () => {
    const { result } = await setupPlayingAWithBAndC();

    await act(async () => result.current.playNextNow());

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(ids(result.current.queue)).toEqual(['c']);
  });

  it('playNextNow does nothing on an empty queue', async () => {
    mockPlayer.current = A;
    const { result } = await setup();

    await act(async () => result.current.playNextNow());

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('playNextNow cancels a running gap and starts exactly one story', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(2000);
    await act(async () => result.current.playNextNow());

    expect(result.current.gapRemainingSec).toBeNull();
    expect(result.current.upNext).toBeNull();
    await tick(GAP_SEC * 1000);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(ids(result.current.queue)).toEqual(['c']);
  });

  it('playNextNow starts even if the sleep timer expired since the finish', async () => {
    const { result, finish, rerender } = await setupPlayingAWithBAndC();

    await finish();
    mockPlayer.sleepExpiredCount += 1;
    await rerender();
    await act(async () => result.current.playNextNow());

    expect(mockPlayer.play).toHaveBeenCalledWith(B);
  });

  it('playNextNow skips a story whose play returns false', async () => {
    mockPlayer.play.mockImplementation((story) => story.id !== 'b');
    const { result } = await setupPlayingAWithBAndC();

    await act(async () => result.current.playNextNow());

    expect(mockPlayer.play.mock.calls.map(([s]) => s.id)).toEqual(['b', 'c']);
    expect(result.current.queue).toEqual([]);
  });

  it('playNextNow updates the route param on a story screen', async () => {
    jest.mocked(usePathname).mockReturnValue('/story/a');
    const { result } = await setupPlayingAWithBAndC();

    await act(async () => result.current.playNextNow());

    expect(router.setParams).toHaveBeenCalledWith({ id: 'b' });
  });

  it('playNow plays the chosen story and removes only it', async () => {
    const { result } = await setupPlayingAWithBAndC();

    await act(async () => result.current.playNow('c'));

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(C);
    expect(ids(result.current.queue)).toEqual(['b']);
  });

  it('playNow keeps the stories above it queued', async () => {
    const { result } = await setupPlayingAWithBAndC();
    const D = makeStory({ id: 'd', title: 'D' });
    await act(async () => result.current.enqueue(D));

    await act(async () => result.current.playNow('c'));

    expect(ids(result.current.queue)).toEqual(['b', 'd']);
  });

  it('playNow cancels a running gap and starts exactly one story', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();

    await finish();
    await tick(2000);
    await act(async () => result.current.playNow('c'));

    expect(result.current.gapRemainingSec).toBeNull();
    await tick(GAP_SEC * 1000);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(C);
  });

  it('playNow ignores an unknown id', async () => {
    const { result } = await setupPlayingAWithBAndC();

    await act(async () => result.current.playNow('zzz'));

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(ids(result.current.queue)).toEqual(['b', 'c']);
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('playNow with a failing play drops the story and does not try others', async () => {
    mockPlayer.play.mockImplementation(() => false);
    const { result } = await setupPlayingAWithBAndC();

    await act(async () => result.current.playNow('c'));

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(C);
    expect(ids(result.current.queue)).toEqual(['b']);
    expect(router.setParams).not.toHaveBeenCalled();
  });

  it('playNow updates the route param on a story screen', async () => {
    jest.mocked(usePathname).mockReturnValue('/story/a');
    const { result } = await setupPlayingAWithBAndC();

    await act(async () => result.current.playNow('c'));

    expect(router.setParams).toHaveBeenCalledWith({ id: 'c' });
  });

  it('removing the last queued story during the gap cancels it', async () => {
    mockPlayer.current = A;
    const { result, finish, tick } = await setup();
    await act(async () => result.current.enqueue(B));

    await finish();
    await act(async () => result.current.remove('b'));

    expect(result.current.upNext).toBeNull();
    expect(result.current.gapRemainingSec).toBeNull();
    await tick(GAP_SEC * 1000);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('unmounting clears the timers', async () => {
    const { finish, unmount } = await setupPlayingAWithBAndC();

    await finish();
    const clearSpy = jest.spyOn(globalThis, 'clearInterval');
    await unmount();

    expect(clearSpy).toHaveBeenCalled();
    jest.advanceTimersByTime(GAP_SEC * 2000);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });
});

describe('useQueue history, previous, shuffle and repeat', () => {
  it('a finished story with repeat one replays at once without a countdown', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();
    await act(async () => result.current.setRepeat('one'));

    await finish();

    expect(mockPlayer.replay).toHaveBeenCalledTimes(1);
    expect(result.current.upNext).toBeNull();
    expect(result.current.gapRemainingSec).toBeNull();
    await tick(GAP_SEC * 2000);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(ids(result.current.queue)).toEqual(['b', 'c']);
  });

  it('repeat one still obeys a sleep expiry and the bedtime lock', async () => {
    mockPlayer.current = A;
    const { result, finish, rerender } = await setup();
    await act(async () => result.current.setRepeat('one'));

    mockPlayer.sleepExpiredCount += 1;
    await finish();
    expect(mockPlayer.replay).not.toHaveBeenCalled();

    mockBedtime.locked = true;
    await rerender();
    await finish();
    expect(mockPlayer.replay).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('repeat all with an empty queue and no history replays the current story', async () => {
    mockPlayer.current = A;
    const { result, finish } = await setup();
    await act(async () => result.current.setRepeat('all'));

    await finish();

    expect(mockPlayer.replay).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
  });

  it('repeat all rebuilds the loop from history and plays it after the countdown', async () => {
    const { result, finish, rerender, tick } = await setupPlayingBAfterA();
    await act(async () => result.current.setRepeat('all'));

    await finish();
    expect(mockPlayer.replay).not.toHaveBeenCalled();
    expect(result.current.upNext).toEqual(A);
    expect(result.current.gapRemainingSec).toBe(GAP_SEC);
    expect(result.current.history).toEqual([]);
    expect(mockPlayer.play).not.toHaveBeenCalled();

    await tick(GAP_SEC * 1000);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(A, { fromStart: true });
    expect(ids(result.current.queue)).toEqual(['b']);

    // The loop restart must not record the finished story: the pass starts from a clean history.
    mockPlayer.current = A;
    await rerender();
    expect(result.current.history).toEqual([]);
  });

  it('repeat off with an empty queue stops as before', async () => {
    const { result, finish, tick } = await setupPlayingBAfterA();

    await finish();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.replay).not.toHaveBeenCalled();
    expect(result.current.upNext).toBeNull();
    expect(result.current.queue).toEqual([]);
  });

  it('starting a new story records the previous one into history', async () => {
    const { result, rerender } = await setupPlayingBAfterA();
    expect(ids(result.current.history)).toEqual(['a']);

    mockPlayer.current = C;
    await rerender();

    expect(ids(result.current.history)).toEqual(['a', 'b']);
  });

  it('playPrevious restarts after more than 3 seconds', async () => {
    const { result, rerender } = await setupPlayingBAfterA();
    mockPlayer.position = 10;
    await rerender();

    await act(async () => result.current.playPrevious());

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(ids(result.current.history)).toEqual(['a']);
  });

  it('playPrevious goes back to the earlier story from the start and queues the current story first', async () => {
    jest.mocked(usePathname).mockReturnValue('/story/b');
    const { result, rerender } = await setupPlayingBAfterA();
    await act(async () => result.current.enqueue(C));
    mockPlayer.position = 1;
    await rerender();

    await act(async () => result.current.playPrevious());

    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(A, { fromStart: true });
    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    expect(ids(result.current.queue)).toEqual(['b', 'c']);
    expect(result.current.history).toEqual([]);
    expect(router.setParams).toHaveBeenCalledWith({ id: 'a' });
  });

  it('the story went back to is not added to history again', async () => {
    const { result, rerender } = await setupPlayingBAfterA();
    await act(async () => result.current.playPrevious());

    mockPlayer.current = A;
    await rerender();
    expect(result.current.history).toEqual([]);
    expect(ids(result.current.queue)).toEqual(['b']);

    await act(async () => result.current.playNextNow());
    mockPlayer.current = B;
    await rerender();
    expect(ids(result.current.history)).toEqual(['a']);
    expect(result.current.queue).toEqual([]);
  });

  it('playPrevious cancels a running countdown', async () => {
    const { result, finish, rerender, tick } = await setupPlayingAWithBAndC();
    await finish();
    mockPlayer.position = 300;
    await rerender();

    await act(async () => result.current.playPrevious());

    expect(result.current.gapRemainingSec).toBeNull();
    expect(result.current.upNext).toBeNull();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    await tick(GAP_SEC * 2000);
    expect(mockPlayer.play).not.toHaveBeenCalled();
  });

  it('playNextNow ignores repeat one', async () => {
    const { result } = await setupPlayingAWithBAndC();
    await act(async () => result.current.setRepeat('one'));

    await act(async () => result.current.playNextNow());

    expect(mockPlayer.replay).not.toHaveBeenCalled();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(ids(result.current.queue)).toEqual(['c']);
  });

  it('canNext is true with a queue or repeat all and false otherwise', async () => {
    mockPlayer.current = A;
    const { result } = await setup();
    expect(result.current.canNext).toBe(false);

    await act(async () => result.current.setRepeat('all'));
    expect(result.current.canNext).toBe(true);
    expect(result.current.repeat).toBe('all');

    await act(async () => result.current.setRepeat('one'));
    expect(result.current.canNext).toBe(false);

    await act(async () => result.current.enqueue(B));
    expect(result.current.canNext).toBe(true);
  });

  it('setShuffle on shuffles the queue and setShuffle off keeps the order', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = await setup();
    await act(async () => {
      result.current.enqueue(A);
      result.current.enqueue(B);
      result.current.enqueue(C);
    });

    await act(async () => result.current.setShuffle(true));
    expect(result.current.shuffle).toBe(true);
    expect(ids(result.current.queue)).toEqual(['b', 'c', 'a']);

    await act(async () => result.current.setShuffle(false));
    expect(result.current.shuffle).toBe(false);
    expect(ids(result.current.queue)).toEqual(['b', 'c', 'a']);
  });

  it('a profile switch resets history shuffle and repeat', async () => {
    const { result, finish, rerender, tick } = await setupPlayingBAfterA();
    await act(async () => {
      result.current.enqueue(C);
      result.current.setShuffle(true);
      result.current.setRepeat('all');
    });
    await finish();
    expect(result.current.gapRemainingSec).toBe(GAP_SEC);

    mockProfiles.activeId = 'kid-2';
    await rerender();
    await tick(GAP_SEC * 2000);

    expect(result.current.history).toEqual([]);
    expect(result.current.shuffle).toBe(false);
    expect(result.current.repeat).toBe('off');
    expect(result.current.queue).toEqual([]);
    expect(result.current.gapRemainingSec).toBeNull();
    expect(mockPlayer.play).not.toHaveBeenCalled();

    // The old profile's story is not recorded into the new profile's history.
    mockPlayer.current = C;
    await rerender();
    expect(result.current.history).toEqual([]);
  });

  it('exactly one next story starts per finish with repeat all and a queue', async () => {
    const { result, finish, tick } = await setupPlayingAWithBAndC();
    await act(async () => result.current.setRepeat('all'));

    await finish();
    await tick(2000);
    await finish();
    await tick(GAP_SEC * 2000);

    expect(mockPlayer.replay).not.toHaveBeenCalled();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(B);
    expect(ids(result.current.queue)).toEqual(['c']);
  });

  it('playNextNow with an empty queue and repeat all starts the loop at once', async () => {
    const { result } = await setupPlayingBAfterA();
    await act(async () => result.current.setRepeat('all'));

    await act(async () => result.current.playNextNow());

    expect(result.current.gapRemainingSec).toBeNull();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(mockPlayer.play).toHaveBeenCalledWith(A, { fromStart: true });
    expect(ids(result.current.queue)).toEqual(['b']);
    expect(result.current.history).toEqual([]);
  });

  it('playPrevious with a story that fails to load shows the error and keeps the screen on the current story', async () => {
    jest.mocked(usePathname).mockReturnValue('/story/b');
    mockPlayer.play.mockImplementation((story: Story) => {
      mockPlayer.current = story;
      return false;
    });
    const { result, rerender } = await setupPlayingBAfterA();

    await act(async () => result.current.playPrevious());
    await rerender();

    expect(mockPlayer.play).toHaveBeenCalledWith(A, { fromStart: true });
    expect(router.setParams).not.toHaveBeenCalled();
    expect(ids(result.current.history)).toEqual(['b']);
    expect(result.current.queue).toEqual([]);
  });
});
