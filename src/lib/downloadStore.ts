import { Directory, File, Paths, type DownloadProgress } from 'expo-file-system';
import type { Story } from '../types';
import { resolveUrl } from './catalog';
import {
  DOWNLOADS_DIR_NAME,
  downloadFileName,
  isPartFile,
  partFileName,
  storyIdFromFileName,
} from './downloads';

export type DownloadedFile = { storyId: string; sizeBytes: number };
export type DownloadHandle = { promise: Promise<void>; cancel: () => void };

// Rebuilt from Paths.document on every call: the iOS container path can change across updates.
const downloadsDirectory = (): Directory => new Directory(Paths.document, DOWNLOADS_DIR_NAME);

const ensureDownloadsDirectory = (): Directory => {
  const directory = downloadsDirectory();
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
};

const filesIn = (directory: Directory): File[] =>
  directory.exists ? directory.list().filter((entry): entry is File => entry instanceof File) : [];

const finishedFilesFor = (storyId: string): File[] =>
  filesIn(downloadsDirectory()).filter((file) => storyIdFromFileName(file.name) === storyId);

const finishedFileFor = (storyId: string): File | undefined => finishedFilesFor(storyId)[0];

const deleteIfPresent = (file: File): void => {
  try {
    if (file.exists) file.delete();
  } catch {
    // already gone or not deletable: nothing more we can do
  }
};

const progressFraction = ({ bytesWritten, totalBytes }: DownloadProgress): number =>
  totalBytes > 0 ? Math.min(1, Math.max(0, bytesWritten / totalBytes)) : 0;

const abortError = (): Error => {
  const error = new Error('cancelled');
  error.name = 'AbortError';
  return error;
};

export async function listDownloaded(): Promise<DownloadedFile[]> {
  const downloaded: DownloadedFile[] = [];
  for (const file of filesIn(ensureDownloadsDirectory())) {
    if (isPartFile(file.name)) {
      deleteIfPresent(file);
      continue;
    }
    const storyId = storyIdFromFileName(file.name);
    if (storyId) downloaded.push({ storyId, sizeBytes: file.size });
  }
  return downloaded;
}

export function startDownload(story: Story, onProgress: (fraction: number) => void): DownloadHandle {
  let cancelled = false;
  const directory = ensureDownloadsDirectory();
  const partFile = new File(directory, partFileName(story));
  const finishedFile = new File(directory, downloadFileName(story));
  const task = File.createDownloadTask(resolveUrl(story.audio), partFile, {
    // Foreground session: downloads that continue while the app is suspended are a non-goal.
    sessionType: 'foreground',
    onProgress: (progress) => {
      if (!cancelled) onProgress(progressFraction(progress));
    },
  });

  // An older download of the same story with another extension would shadow the new file.
  const deleteOlderCopies = (): void => {
    try {
      for (const file of finishedFilesFor(story.id)) {
        if (file.name !== finishedFile.name) deleteIfPresent(file);
      }
    } catch {
      // listing failed: the new file is in place, the stale one is only wasted space
    }
  };

  const run = async (): Promise<void> => {
    try {
      const result = await task.downloadAsync();
      if (cancelled) throw abortError();
      if (!result) throw new Error('Download stopped before it finished');
      await partFile.move(finishedFile, { overwrite: true });
    } catch (error) {
      deleteIfPresent(partFile);
      throw cancelled ? abortError() : error;
    }
    deleteOlderCopies();
  };

  const cancel = (): void => {
    if (cancelled) return;
    cancelled = true;
    task.cancel();
  };

  return { promise: run(), cancel };
}

export async function removeDownloaded(storyId: string): Promise<void> {
  for (const file of finishedFilesFor(storyId)) {
    if (file.exists) file.delete();
  }
}

// Read-only: the provider sizes one finished download without listDownloaded, which would delete
// the .part file of whatever is downloading next.
export function downloadedSize(storyId: string): number | null {
  const file = finishedFileFor(storyId);
  return file?.exists ? file.size : null;
}

export function localUri(storyId: string): string | null {
  const file = finishedFileFor(storyId);
  return file?.exists ? file.uri : null;
}

// Used by "Delete all data": the providers are unmounted first, so nothing is downloading or playing from here.
export function removeAllDownloads(): void {
  const directory = downloadsDirectory();
  if (directory.exists) directory.delete();
}
