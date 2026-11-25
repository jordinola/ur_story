import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { makeStory } from '../test/fixtures';
import type { Story } from '../types';
import { downloadedSize, listDownloaded, localUri, removeDownloaded, startDownload } from './downloadStore';
import { DownloadsProvider, useDownloads } from './DownloadsProvider';

jest.mock('./downloadStore', () => ({
  listDownloaded: jest.fn(),
  startDownload: jest.fn(),
  removeDownloaded: jest.fn(),
  localUri: jest.fn(),
  downloadedSize: jest.fn(),
}));

const FAILED = 'Could not download this story. Check your connection.';
const INTERRUPTED = 'Download interrupted. Try again.';

// A controllable stand-in for the store's handle: the test settles it, and cancel rejects with
// an AbortError the way the real store does.
type FakeDownload = {
  story: Story;
  onProgress: (fraction: number) => void;
  succeed: () => void;
  fail: (error?: Error) => void;
  cancel: jest.Mock;
};

const downloads: FakeDownload[] = [];

const abortError = () => {
  const error = new Error('cancelled');
  error.name = 'AbortError';
  return error;
};

const fakeStartDownload = (story: Story, onProgress: (fraction: number) => void) => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const cancel = jest.fn(() => reject(abortError()));
  downloads.push({ story, onProgress, succeed: resolve, fail: (error = new Error('network down')) => reject(error), cancel });
  return { promise, cancel };
};

const downloadFor = (storyId: string): FakeDownload => {
  const found = downloads.find((d) => d.story.id === storyId);
  if (!found) throw new Error(`no download started for ${storyId}`);
  return found;
};

const moon = makeStory({ id: 'moon', title: 'The Sleepy Moon' });
const fox = makeStory({ id: 'fox', title: 'Brave Fox' });
const owl = makeStory({ id: 'owl', title: 'Wise Owl' });

const wrapper = ({ children }: { children: ReactNode }) => <DownloadsProvider>{children}</DownloadsProvider>;

let appStateHandler: ((state: AppStateStatus) => void) | null = null;
const removeListener = jest.fn();
const presetCurrentState = AppState.currentState;

afterAll(() => {
  AppState.currentState = presetCurrentState;
});

async function setup() {
  const hook = await renderHook(() => useDownloads(), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  downloads.length = 0;
  appStateHandler = null;
  jest.mocked(listDownloaded).mockResolvedValue([]);
  jest.mocked(startDownload).mockImplementation(fakeStartDownload);
  jest.mocked(removeDownloaded).mockResolvedValue(undefined);
  jest.mocked(downloadedSize).mockReturnValue(1000);
  jest.mocked(localUri).mockImplementation((id) => `file:///doc/downloads/${id}.mp3`);
  // The jest preset's AppState mock has no real currentState; the app starts in the foreground.
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler;
    return { remove: removeListener };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const changeAppState = async (state: AppStateStatus) => {
  await act(async () => appStateHandler?.(state));
};

describe('useDownloads', () => {
  it('throws outside of DownloadsProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useDownloads())).rejects.toThrow('useDownloads must be used inside DownloadsProvider');
    spy.mockRestore();
  });

  it('lists downloaded stories at launch and becomes ready', async () => {
    jest.mocked(listDownloaded).mockResolvedValue([
      { storyId: 'moon', sizeBytes: 1200 },
      { storyId: 'fox', sizeBytes: 3400 },
    ]);

    const { result } = await setup();

    expect(result.current.downloaded).toEqual({ moon: { sizeBytes: 1200 }, fox: { sizeBytes: 3400 } });
    expect(listDownloaded).toHaveBeenCalledTimes(1);
  });

  it('becomes ready even if listing fails', async () => {
    jest.mocked(listDownloaded).mockRejectedValue(new Error('disk'));

    const { result } = await setup();

    expect(result.current.downloaded).toEqual({});
  });

  it('does not expose remove or totalBytes: removal goes through the parental gate', async () => {
    const { result } = await setup();

    expect(result.current).not.toHaveProperty('remove');
    expect(result.current).not.toHaveProperty('totalBytes');
  });

  it('stores a progress update only when the rounded percentage changes', async () => {
    let renders = 0;
    const observed = new Set<number | undefined>();
    const hook = await renderHook(
      () => {
        renders += 1;
        const value = useDownloads();
        observed.add(value.progress.moon);
        return value;
      },
      { wrapper },
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await act(async () => hook.result.current.download(moon));
    const rendersBefore = renders;

    for (let i = 1; i <= 1000; i += 1) {
      await act(async () => downloadFor('moon').onProgress(i / 1000));
    }

    expect(renders - rendersBefore).toBeLessThanOrEqual(101);
    expect(observed.size).toBeLessThanOrEqual(102);
    expect(Math.round((hook.result.current.progress.moon ?? 0) * 100)).toBe(100);
  });

  it('download marks progress and then the story as downloaded', async () => {
    jest.mocked(downloadedSize).mockReturnValue(5000);
    const { result } = await setup();

    await act(async () => result.current.download(moon));
    expect(result.current.progress).toEqual({ moon: 0 });

    await act(async () => downloadFor('moon').onProgress(0.4));
    expect(result.current.progress).toEqual({ moon: 0.4 });

    await act(async () => downloadFor('moon').succeed());
    expect(result.current.progress).toEqual({});
    expect(result.current.downloaded).toEqual({ moon: { sizeBytes: 5000 } });
    expect(downloadedSize).toHaveBeenCalledWith('moon');
    // The launch listing deletes .part files, so it must never run again once downloads start.
    expect(listDownloaded).toHaveBeenCalledTimes(1);
  });

  it('waits for the launch listing before starting, and skips stories it finds', async () => {
    let finishListing!: (files: { storyId: string; sizeBytes: number }[]) => void;
    jest.mocked(listDownloaded).mockReturnValue(new Promise((res) => (finishListing = res)));
    const { result } = await renderHook(() => useDownloads(), { wrapper });

    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
    });
    expect(startDownload).not.toHaveBeenCalled();

    await act(async () => finishListing([{ storyId: 'moon', sizeBytes: 1200 }]));

    expect(result.current.ready).toBe(true);
    expect(startDownload).toHaveBeenCalledTimes(1);
    expect(jest.mocked(startDownload).mock.calls[0]?.[0]).toBe(fox);
    expect(result.current.progress).toEqual({ fox: 0 });
  });

  it('downloads run one at a time in request order', async () => {
    const { result } = await setup();

    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
      result.current.download(owl);
    });
    expect(startDownload).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toEqual({ moon: 0, fox: 0, owl: 0 });

    await act(async () => downloadFor('moon').succeed());
    expect(startDownload).toHaveBeenCalledTimes(2);
    expect(jest.mocked(startDownload).mock.calls[1]?.[0]).toBe(fox);

    await act(async () => downloadFor('fox').succeed());
    expect(jest.mocked(startDownload).mock.calls[2]?.[0]).toBe(owl);

    await act(async () => downloadFor('owl').succeed());
    expect(Object.keys(result.current.downloaded)).toEqual(['moon', 'fox', 'owl']);
    expect(result.current.progress).toEqual({});
  });

  it('a duplicate download request is ignored', async () => {
    jest.mocked(listDownloaded).mockResolvedValue([{ storyId: 'owl', sizeBytes: 1 }]);
    const { result } = await setup();

    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
      result.current.download(moon);
      result.current.download(fox);
      result.current.download(owl);
    });
    await act(async () => downloadFor('moon').succeed());
    await act(async () => downloadFor('fox').succeed());
    await act(async () => result.current.download(moon));

    expect(jest.mocked(startDownload).mock.calls.map(([story]) => story.id)).toEqual(['moon', 'fox']);
  });

  it('cancel stops a running download and starts the next', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
    });

    await act(async () => result.current.cancel('moon'));

    expect(downloadFor('moon').cancel).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toEqual({ fox: 0 });
    expect(result.current.errors).toEqual({});
    expect(result.current.downloaded).toEqual({});
    expect(jest.mocked(startDownload).mock.calls[1]?.[0]).toBe(fox);
  });

  it('counts a download that finishes despite a late cancel', async () => {
    const { result } = await setup();
    await act(async () => result.current.download(moon));
    // The store ignores a cancel that lands during the final rename and resolves anyway.
    downloadFor('moon').cancel.mockImplementation(() => {});

    await act(async () => result.current.cancel('moon'));
    await act(async () => downloadFor('moon').succeed());

    expect(result.current.downloaded).toEqual({ moon: { sizeBytes: 1000 } });
    expect(result.current.errors).toEqual({});
  });

  it('cancel drops a queued download', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
      result.current.download(owl);
    });

    await act(async () => result.current.cancel('fox'));
    expect(result.current.progress).toEqual({ moon: 0, owl: 0 });
    expect(downloadFor('moon').cancel).not.toHaveBeenCalled();

    await act(async () => downloadFor('moon').succeed());
    expect(jest.mocked(startDownload).mock.calls.map(([story]) => story.id)).toEqual(['moon', 'owl']);
  });

  it('a failed download sets the friendly error and clears progress', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
    });

    await act(async () => downloadFor('moon').fail());

    expect(result.current.errors).toEqual({ moon: FAILED });
    expect(result.current.progress).toEqual({ fox: 0 });
    expect(result.current.downloaded).toEqual({});
    expect(jest.mocked(startDownload).mock.calls[1]?.[0]).toBe(fox);
  });

  it('a download that cannot start is a failure and the queue moves on', async () => {
    const { result } = await setup();
    jest.mocked(startDownload).mockImplementationOnce(() => {
      throw new Error('cannot create folder');
    });

    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
    });

    expect(result.current.errors).toEqual({ moon: FAILED });
    expect(result.current.progress).toEqual({ fox: 0 });
    expect(downloadFor('fox')).toBeDefined();
  });

  it('a finished download whose file is missing is a failure', async () => {
    jest.mocked(downloadedSize).mockReturnValue(null);
    const { result } = await setup();
    await act(async () => result.current.download(moon));

    await act(async () => downloadFor('moon').succeed());

    expect(result.current.downloaded).toEqual({});
    expect(result.current.errors).toEqual({ moon: FAILED });
  });

  it('retrying clears the error', async () => {
    const { result } = await setup();
    await act(async () => result.current.download(moon));
    await act(async () => downloadFor('moon').fail());
    expect(result.current.errors).toEqual({ moon: FAILED });

    await act(async () => result.current.download(moon));

    expect(result.current.errors).toEqual({});
    expect(result.current.progress).toEqual({ moon: 0 });
    expect(startDownload).toHaveBeenCalledTimes(2);
  });

  it('requestRemove then confirmRemoval removes the file and the entry', async () => {
    jest.mocked(listDownloaded).mockResolvedValue([
      { storyId: 'moon', sizeBytes: 1200 },
      { storyId: 'fox', sizeBytes: 3400 },
    ]);
    const { result } = await setup();

    await act(async () => result.current.requestRemove(moon));
    expect(result.current.pendingRemoval).toBe(moon);

    await act(async () => result.current.confirmRemoval());

    expect(removeDownloaded).toHaveBeenCalledWith('moon');
    expect(result.current.pendingRemoval).toBeNull();
    expect(result.current.downloaded).toEqual({ fox: { sizeBytes: 3400 } });
  });

  it('keeps the entry when removing the file fails', async () => {
    jest.mocked(listDownloaded).mockResolvedValue([{ storyId: 'moon', sizeBytes: 1200 }]);
    jest.mocked(removeDownloaded).mockRejectedValue(new Error('locked'));
    const { result } = await setup();

    await act(async () => result.current.requestRemove(moon));
    await act(async () => result.current.confirmRemoval());

    expect(result.current.pendingRemoval).toBeNull();
    expect(result.current.downloaded).toEqual({ moon: { sizeBytes: 1200 } });
  });

  it('dismissRemoval keeps the file', async () => {
    jest.mocked(listDownloaded).mockResolvedValue([{ storyId: 'moon', sizeBytes: 1200 }]);
    const { result } = await setup();

    await act(async () => result.current.requestRemove(moon));
    await act(async () => result.current.dismissRemoval());

    expect(result.current.pendingRemoval).toBeNull();
    expect(removeDownloaded).not.toHaveBeenCalled();
    expect(result.current.downloaded).toEqual({ moon: { sizeBytes: 1200 } });
  });

  it('returning to the foreground marks an interrupted download failed', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.download(moon);
      result.current.download(fox);
    });
    await act(async () => downloadFor('moon').onProgress(0.5));

    await changeAppState('background');
    await changeAppState('active');

    expect(downloadFor('moon').cancel).toHaveBeenCalledTimes(1);
    expect(result.current.errors).toEqual({ moon: INTERRUPTED });
    expect(result.current.progress).toEqual({ fox: 0 });
    expect(jest.mocked(startDownload).mock.calls[1]?.[0]).toBe(fox);
    expect(listDownloaded).toHaveBeenCalledTimes(1);
  });

  it('leaves a download running when the app only went inactive', async () => {
    const { result } = await setup();
    await act(async () => result.current.download(moon));

    await changeAppState('inactive');
    await changeAppState('active');

    expect(downloadFor('moon').cancel).not.toHaveBeenCalled();
    expect(result.current.progress).toEqual({ moon: 0 });
  });

  it('does not touch a download started after returning to the foreground', async () => {
    const { result } = await setup();
    await changeAppState('background');
    await changeAppState('active');

    await act(async () => result.current.download(moon));
    await changeAppState('active');

    expect(downloadFor('moon').cancel).not.toHaveBeenCalled();
  });

  it('interrupts a download that started after the app went to the background while idle', async () => {
    const { result } = await setup();
    await changeAppState('background');

    await act(async () => result.current.download(moon));
    await changeAppState('active');

    expect(downloadFor('moon').cancel).toHaveBeenCalledTimes(1);
    expect(result.current.errors).toEqual({ moon: INTERRUPTED });
    expect(result.current.progress).toEqual({});
  });

  it('leaves a download started while active alone on an active event', async () => {
    const { result } = await setup();
    await act(async () => result.current.download(moon));

    await changeAppState('active');

    expect(downloadFor('moon').cancel).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({});
    expect(result.current.progress).toEqual({ moon: 0 });
  });

  it('localUri is null unless downloaded', async () => {
    jest.mocked(listDownloaded).mockResolvedValue([{ storyId: 'moon', sizeBytes: 1200 }]);
    const { result } = await setup();

    expect(result.current.localUri('fox')).toBeNull();
    expect(localUri).not.toHaveBeenCalled();
    expect(result.current.localUri('moon')).toBe('file:///doc/downloads/moon.mp3');
  });

  it('unmount cancels the running download and stops listening to the app state', async () => {
    const hook = await setup();
    await act(async () => hook.result.current.download(moon));

    await hook.unmount();

    expect(downloadFor('moon').cancel).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalled();
  });
});
