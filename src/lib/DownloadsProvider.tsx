import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { Story } from '../types';
import {
  downloadedSize,
  listDownloaded,
  localUri as storedLocalUri,
  removeDownloaded,
  startDownload,
  type DownloadedFile,
  type DownloadHandle,
} from './downloadStore';

type DownloadedMap = Record<string, { sizeBytes: number }>;

type DownloadsContextValue = {
  /** True after the launch listing of the downloads folder (or its failure). */
  ready: boolean;
  downloaded: DownloadedMap;
  /** 0..1 for queued and running downloads (0 while queued). */
  progress: Record<string, number>;
  /** A friendly message per story id; cleared when the story is downloaded again. */
  errors: Record<string, string>;
  /** Ignored when already downloaded, queued or running. Downloads run one at a time in request order. */
  download: (story: Story) => void;
  cancel: (storyId: string) => void;
  /** Asks for the parental gate (RemoveDownloadGate) before removing. */
  requestRemove: (story: Story) => void;
  pendingRemoval: Story | null;
  confirmRemoval: () => void;
  dismissRemoval: () => void;
  /** Null unless the story is downloaded. Lists the folder: fine per play, not in render loops. */
  localUri: (storyId: string) => string | null;
};

export const DOWNLOAD_FAILED_MESSAGE = 'Could not download this story. Check your connection.';
export const DOWNLOAD_INTERRUPTED_MESSAGE = 'Download interrupted. Try again.';

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

const without = <T,>(record: Record<string, T>, key: string): Record<string, T> => {
  if (!(key in record)) return record;
  const { [key]: _removed, ...rest } = record;
  return rest;
};

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

const cancelQuietly = (handle: DownloadHandle): void => {
  try {
    handle.cancel();
  } catch {
    // the task is already gone; the store cleans up its own .part file
  }
};

const sizeOnDisk = (storyId: string): number | null => {
  try {
    return downloadedSize(storyId);
  } catch {
    return null;
  }
};

type Running = { story: Story; handle: DownloadHandle; backgrounded: boolean };

type QueueSetters = {
  setDownloaded: Dispatch<SetStateAction<DownloadedMap>>;
  setProgress: Dispatch<SetStateAction<Record<string, number>>>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
};

// The queue lives in a closure, not in React state: download, cancel and a settling promise can
// all land in the same tick, and each must see the others' changes at once. React state only
// mirrors it for rendering.
function createDownloadQueue({ setDownloaded, setProgress, setErrors }: QueueSetters) {
  // listDownloaded deletes every .part file, so nothing may start until the launch listing is done.
  let listed = false;
  let listingStarted = false;
  let open = true;
  const downloadedIds = new Set<string>();
  const waiting: Story[] = [];
  let running: Running | null = null;
  // Tracked even while idle: a download that starts during the iOS grace period after the app
  // leaves the foreground must still count as interrupted when the app comes back.
  let inBackground = AppState.currentState !== 'active';

  const setFraction = (storyId: string, fraction: number) => setProgress((p) => ({ ...p, [storyId]: fraction }));
  const clearProgress = (storyId: string) => setProgress((p) => without(p, storyId));
  const setError = (storyId: string, message: string) => setErrors((e) => ({ ...e, [storyId]: message }));
  const clearError = (storyId: string) => setErrors((e) => without(e, storyId));

  const markDownloaded = (storyId: string, sizeBytes: number) => {
    downloadedIds.add(storyId);
    setDownloaded((d) => ({ ...d, [storyId]: { sizeBytes } }));
    clearError(storyId);
  };

  const finishRunning = (storyId: string) => {
    running = null;
    clearProgress(storyId);
    startNext();
  };

  const onSucceeded = (entry: Running) => {
    const storyId = entry.story.id;
    const stillRunning = running === entry;
    // Read the size without listDownloaded (it would delete the next download's .part file).
    const sizeBytes = sizeOnDisk(storyId);
    // A cancel or interruption that lands during the store's final rename still resolves: the
    // file is complete, so it counts as downloaded even though we already moved on.
    if (sizeBytes != null) markDownloaded(storyId, sizeBytes);
    else if (stillRunning) setError(storyId, DOWNLOAD_FAILED_MESSAGE);
    if (stillRunning) finishRunning(storyId);
  };

  const onFailed = (entry: Running, error: unknown) => {
    // Cancelled or interrupted downloads were already handled when we cancelled them.
    if (running !== entry) return;
    if (!isAbortError(error)) setError(entry.story.id, DOWNLOAD_FAILED_MESSAGE);
    finishRunning(entry.story.id);
  };

  function startNext(): void {
    while (listed && open && !running) {
      const story = waiting.shift();
      if (!story) return;
      // Requested before the launch listing finished and turned out to be on disk already.
      if (downloadedIds.has(story.id)) {
        clearProgress(story.id);
        continue;
      }
      let handle: DownloadHandle;
      // The store reports about every 0.1 s and each stored update re-renders the home grid, so
      // only whole-percent changes are stored. Queued downloads already show 0.
      let storedPercent = 0;
      try {
        // startDownload can throw synchronously while it sets up the folder or the task.
        handle = startDownload(story, (fraction) => {
          if (running?.story.id !== story.id) return;
          const percent = Math.round(fraction * 100);
          if (percent === storedPercent) return;
          storedPercent = percent;
          setFraction(story.id, fraction);
        });
      } catch {
        setError(story.id, DOWNLOAD_FAILED_MESSAGE);
        clearProgress(story.id);
        continue;
      }
      const entry: Running = { story, handle, backgrounded: inBackground };
      running = entry;
      handle.promise.then(
        () => onSucceeded(entry),
        (error: unknown) => onFailed(entry, error),
      );
    }
  }

  const isQueuedOrRunning = (storyId: string) =>
    running?.story.id === storyId || waiting.some((story) => story.id === storyId);

  const stopRunning = (): Story | null => {
    if (!running) return null;
    const { story, handle } = running;
    // Clear first so the AbortError the cancel produces is not reported as a failure.
    running = null;
    cancelQuietly(handle);
    return story;
  };

  return {
    launchListed(files: DownloadedFile[]) {
      for (const { storyId } of files) downloadedIds.add(storyId);
      const fromDisk = Object.fromEntries(files.map(({ storyId, sizeBytes }) => [storyId, { sizeBytes }]));
      setDownloaded((d) => ({ ...fromDisk, ...d }));
      listed = true;
      startNext();
    },

    download(story: Story) {
      if (downloadedIds.has(story.id) || isQueuedOrRunning(story.id)) return;
      clearError(story.id);
      setFraction(story.id, 0);
      waiting.push(story);
      startNext();
    },

    cancel(storyId: string) {
      const index = waiting.findIndex((story) => story.id === storyId);
      if (index >= 0) {
        waiting.splice(index, 1);
        clearProgress(storyId);
        return;
      }
      if (running?.story.id !== storyId) return;
      stopRunning();
      clearProgress(storyId);
      startNext();
    },

    async remove(storyId: string) {
      await removeDownloaded(storyId);
      downloadedIds.delete(storyId);
      setDownloaded((d) => without(d, storyId));
    },

    // The store handle cannot report the native task state, so we treat a trip to the background
    // as the interruption: a foreground download session does not reliably survive suspension and
    // a stalled task never settles. An 'inactive' blip (Control Center, a system alert) does not count.
    appStateChanged(state: AppStateStatus) {
      if (state === 'background') {
        inBackground = true;
        if (running) running.backgrounded = true;
        return;
      }
      if (state !== 'active') return;
      inBackground = false;
      if (!running?.backgrounded) return;
      const story = stopRunning();
      if (!story) return;
      setError(story.id, DOWNLOAD_INTERRUPTED_MESSAGE);
      clearProgress(story.id);
      startNext();
    },

    // True only for the first caller, so an effect re-run (Fast Refresh, Strict Mode) never lists
    // again: listing deletes .part files.
    claimLaunchListing() {
      if (listingStarted) return false;
      listingStarted = true;
      return true;
    },

    open() {
      open = true;
      startNext();
    },

    // Unmount: stop the running download (the store deletes its .part file) and forget the queue.
    close() {
      open = false;
      for (const story of waiting.splice(0)) clearProgress(story.id);
      const story = stopRunning();
      if (story) clearProgress(story.id);
    },
  };
}

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [downloaded, setDownloaded] = useState<DownloadedMap>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingRemoval, setPendingRemoval] = useState<Story | null>(null);
  const [queue] = useState(() => createDownloadQueue({ setDownloaded, setProgress, setErrors }));

  useEffect(() => {
    queue.open();
    if (queue.claimLaunchListing()) {
      listDownloaded()
        .catch((): DownloadedFile[] => [])
        .then((files) => {
          queue.launchListed(files);
          setReady(true);
        });
    }
    const subscription = AppState.addEventListener('change', queue.appStateChanged);
    return () => {
      subscription.remove();
      queue.close();
    };
  }, [queue]);

  const requestRemove = useCallback((story: Story) => setPendingRemoval(story), []);
  const dismissRemoval = useCallback(() => setPendingRemoval(null), []);
  const confirmRemoval = useCallback(() => {
    if (!pendingRemoval) return;
    setPendingRemoval(null);
    // On failure the file and its entry stay; the parent can try again.
    queue.remove(pendingRemoval.id).catch(() => {});
  }, [pendingRemoval, queue]);

  const localUri = useCallback(
    (storyId: string): string | null => {
      if (!downloaded[storyId]) return null;
      try {
        return storedLocalUri(storyId);
      } catch {
        return null;
      }
    },
    [downloaded],
  );

  const value = useMemo<DownloadsContextValue>(
    () => ({
      ready,
      downloaded,
      progress,
      errors,
      download: queue.download,
      cancel: queue.cancel,
      requestRemove,
      pendingRemoval,
      confirmRemoval,
      dismissRemoval,
      localUri,
    }),
    [ready, downloaded, progress, errors, queue, requestRemove, pendingRemoval, confirmRemoval, dismissRemoval, localUri],
  );

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

export function useDownloads(): DownloadsContextValue {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error('useDownloads must be used inside DownloadsProvider');
  return ctx;
}
