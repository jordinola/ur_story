import { makeStory } from '../test/fixtures';
import { resolveUrl } from './catalog';
import {
  downloadedSize,
  listDownloaded,
  localUri,
  removeAllDownloads,
  removeDownloaded,
  startDownload,
} from './downloadStore';

type MockProgress = { bytesWritten: number; totalBytes: number };
type MockPart = string | { uri: string };
type MockTaskOptions = { onProgress?: (progress: MockProgress) => void };
type FakeTask = {
  url: string;
  destinationUri: string;
  progress: (bytesWritten: number, totalBytes: number) => void;
  finish: (sizeBytes: number) => void;
  fail: (error: Error) => void;
};

const mockFs = {
  files: new Map<string, number>(),
  dirs: new Set<string>(),
  tasks: [] as FakeTask[],
};

jest.mock('expo-file-system', () => {
  const join = (parts: MockPart[]) => parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
  const parentOf = (uri: string) => uri.slice(0, uri.lastIndexOf('/'));
  const nameOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

  class File {
    uri: string;
    constructor(...parts: MockPart[]) {
      this.uri = join(parts);
    }
    get name() {
      return nameOf(this.uri);
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    get size() {
      return mockFs.files.get(this.uri) ?? 0;
    }
    delete() {
      if (!mockFs.files.delete(this.uri)) throw new Error(`missing ${this.uri}`);
    }
    async move(destination: { uri: string }, options?: { overwrite?: boolean }) {
      if (!this.exists) throw new Error(`missing ${this.uri}`);
      if (mockFs.files.has(destination.uri) && !options?.overwrite) throw new Error('exists');
      mockFs.files.set(destination.uri, this.size);
      mockFs.files.delete(this.uri);
      this.uri = destination.uri;
    }
    static createDownloadTask(url: string, destination: File, options?: MockTaskOptions) {
      let settle: { resolve: (file: File) => void; reject: (error: Error) => void } | undefined;
      let state = 'idle';
      const task = {
        url,
        destinationUri: destination.uri,
        get state() {
          return state;
        },
        downloadAsync: () =>
          new Promise<File>((resolve, reject) => {
            state = 'active';
            mockFs.files.set(destination.uri, 1);
            settle = { resolve, reject };
          }),
        cancel: () => {
          state = 'cancelled';
          settle?.reject(new Error('cancelled by native'));
        },
        progress: (bytesWritten: number, totalBytes: number) =>
          options?.onProgress?.({ bytesWritten, totalBytes }),
        finish: (sizeBytes: number) => {
          state = 'completed';
          mockFs.files.set(destination.uri, sizeBytes);
          settle?.resolve(new File(destination.uri));
        },
        fail: (error: Error) => {
          state = 'error';
          settle?.reject(error);
        },
      };
      mockFs.tasks.push(task);
      return task;
    }
  }

  class Directory {
    uri: string;
    constructor(...parts: MockPart[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFs.dirs.has(this.uri);
    }
    create() {
      mockFs.dirs.add(this.uri);
    }
    delete() {
      if (!this.exists) throw new Error(`missing ${this.uri}`);
      mockFs.dirs.delete(this.uri);
      for (const uri of [...mockFs.files.keys()]) {
        if (parentOf(uri) === this.uri) mockFs.files.delete(uri);
      }
    }
    list() {
      if (!this.exists) throw new Error(`missing ${this.uri}`);
      const files = [...mockFs.files.keys()].filter((uri) => parentOf(uri) === this.uri);
      const dirs = [...mockFs.dirs].filter((uri) => parentOf(uri) === this.uri);
      return [...files.map((uri) => new File(uri)), ...dirs.map((uri) => new Directory(uri))];
    }
  }

  const document = new Directory('file:///doc');
  return {
    File,
    Directory,
    Paths: {
      get document() {
        return document;
      },
    },
  };
});

const DIR = 'file:///doc/downloads';
const story = makeStory({ id: 'sleepy-moon', audio: 'audio/sleepy-moon.mp3' });
const partUri = `${DIR}/sleepy-moon.mp3.part`;
const finishedUri = `${DIR}/sleepy-moon.mp3`;

const lastTask = (): FakeTask => {
  const task = mockFs.tasks[mockFs.tasks.length - 1];
  if (!task) throw new Error('no download task was created');
  return task;
};

beforeEach(() => {
  mockFs.files.clear();
  mockFs.dirs.clear();
  mockFs.dirs.add('file:///doc');
  mockFs.dirs.add(DIR);
  mockFs.tasks.length = 0;
});

describe('listDownloaded', () => {
  it('listDownloaded lists finished files with their sizes', async () => {
    mockFs.files.set(`${DIR}/sleepy-moon.mp3`, 1200);
    mockFs.files.set(`${DIR}/brave-fox.m4a`, 3400);

    const result = await listDownloaded();

    expect(result).toEqual(
      expect.arrayContaining([
        { storyId: 'sleepy-moon', sizeBytes: 1200 },
        { storyId: 'brave-fox', sizeBytes: 3400 },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it('listDownloaded deletes part files and ignores unknown files', async () => {
    mockFs.files.set(`${DIR}/sleepy-moon.mp3`, 1200);
    mockFs.files.set(`${DIR}/brave-fox.mp3.part`, 50);
    mockFs.files.set(`${DIR}/README`, 10);
    mockFs.dirs.add(`${DIR}/nested`);

    const result = await listDownloaded();

    expect(result).toEqual([{ storyId: 'sleepy-moon', sizeBytes: 1200 }]);
    expect(mockFs.files.has(`${DIR}/brave-fox.mp3.part`)).toBe(false);
    expect(mockFs.files.has(`${DIR}/README`)).toBe(true);
  });

  it('listDownloaded creates the folder when missing', async () => {
    mockFs.dirs.delete(DIR);

    await expect(listDownloaded()).resolves.toEqual([]);
    expect(mockFs.dirs.has(DIR)).toBe(true);
  });
});

describe('startDownload', () => {
  it('startDownload reports progress as a fraction', () => {
    const onProgress = jest.fn();
    const handle = startDownload(story, onProgress);
    handle.promise.catch(() => {});
    const task = lastTask();

    expect(task.url).toBe(resolveUrl(story.audio));
    task.progress(25, 100);
    task.progress(150, 100);
    task.progress(10, 0);
    task.progress(10, -1);

    expect(onProgress.mock.calls).toEqual([[0.25], [1], [0], [0]]);
    handle.cancel();
  });

  it('startDownload renames the part file only when finished', async () => {
    const handle = startDownload(story, jest.fn());
    const task = lastTask();

    expect(task.destinationUri).toBe(partUri);
    expect(mockFs.files.has(finishedUri)).toBe(false);

    task.finish(5000);
    await expect(handle.promise).resolves.toBeUndefined();

    expect(mockFs.files.get(finishedUri)).toBe(5000);
    expect(mockFs.files.has(partUri)).toBe(false);
  });

  it('a finished download deletes an older file for the same story with another extension', async () => {
    mockFs.files.set(`${DIR}/sleepy-moon.m4a`, 900);
    mockFs.files.set(`${DIR}/brave-fox.m4a`, 3400);
    const handle = startDownload(story, jest.fn());

    lastTask().finish(5000);
    await handle.promise;

    expect(mockFs.files.get(finishedUri)).toBe(5000);
    expect(mockFs.files.has(`${DIR}/sleepy-moon.m4a`)).toBe(false);
    expect(mockFs.files.has(`${DIR}/brave-fox.m4a`)).toBe(true);
  });

  it('a failed download deletes the part file and rejects', async () => {
    const handle = startDownload(story, jest.fn());
    const task = lastTask();
    expect(mockFs.files.has(partUri)).toBe(true);

    task.fail(new Error('network down'));

    await expect(handle.promise).rejects.toThrow('network down');
    expect(mockFs.files.has(partUri)).toBe(false);
    expect(mockFs.files.has(finishedUri)).toBe(false);
  });

  it('cancel deletes the part file and rejects', async () => {
    const handle = startDownload(story, jest.fn());
    expect(mockFs.files.has(partUri)).toBe(true);

    handle.cancel();

    await expect(handle.promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockFs.files.has(partUri)).toBe(false);
    expect(mockFs.files.has(finishedUri)).toBe(false);
  });
});

describe('removeDownloaded', () => {
  it('removeDownloaded deletes the file and ignores a missing one', async () => {
    mockFs.files.set(`${DIR}/sleepy-moon.m4a`, 1200);
    mockFs.files.set(`${DIR}/brave-fox.mp3`, 3400);

    await removeDownloaded('sleepy-moon');

    expect(mockFs.files.has(`${DIR}/sleepy-moon.m4a`)).toBe(false);
    expect(mockFs.files.has(`${DIR}/brave-fox.mp3`)).toBe(true);
    await expect(removeDownloaded('sleepy-moon')).resolves.toBeUndefined();
    mockFs.dirs.delete(DIR);
    await expect(removeDownloaded('sleepy-moon')).resolves.toBeUndefined();
  });
});

describe('removeDownloaded with several files', () => {
  it('removeDownloaded deletes every file for the story', async () => {
    mockFs.files.set(`${DIR}/sleepy-moon.m4a`, 1200);
    mockFs.files.set(`${DIR}/sleepy-moon.mp3`, 1300);
    mockFs.files.set(`${DIR}/brave-fox.mp3`, 3400);

    await removeDownloaded('sleepy-moon');

    expect(mockFs.files.has(`${DIR}/sleepy-moon.m4a`)).toBe(false);
    expect(mockFs.files.has(`${DIR}/sleepy-moon.mp3`)).toBe(false);
    expect(mockFs.files.has(`${DIR}/brave-fox.mp3`)).toBe(true);
  });
});

describe('localUri', () => {
  it('localUri returns the file uri only when the file exists', () => {
    expect(localUri('sleepy-moon')).toBeNull();

    mockFs.files.set(`${DIR}/sleepy-moon.mp3.part`, 10);
    expect(localUri('sleepy-moon')).toBeNull();

    mockFs.files.set(finishedUri, 1200);
    expect(localUri('sleepy-moon')).toBe(finishedUri);

    mockFs.dirs.delete(DIR);
    mockFs.files.clear();
    expect(localUri('sleepy-moon')).toBeNull();
  });
});

describe('downloadedSize', () => {
  it('downloadedSize returns the finished file size, ignoring part files', () => {
    expect(downloadedSize('sleepy-moon')).toBeNull();

    mockFs.files.set(partUri, 10);
    expect(downloadedSize('sleepy-moon')).toBeNull();

    mockFs.files.set(finishedUri, 4200);
    expect(downloadedSize('sleepy-moon')).toBe(4200);
    expect(mockFs.files.has(partUri)).toBe(true);
  });
});

describe('removeAllDownloads', () => {
  it('deletes the downloads folder with every file in it', () => {
    mockFs.files.set(`${DIR}/sleepy-moon.mp3`, 1200);
    mockFs.files.set(`${DIR}/brave-fox.m4a.part`, 10);

    removeAllDownloads();

    expect(mockFs.dirs.has(DIR)).toBe(false);
    expect(mockFs.files.size).toBe(0);
  });

  it('does nothing when the downloads folder does not exist', () => {
    mockFs.dirs.delete(DIR);

    expect(() => removeAllDownloads()).not.toThrow();
  });
});
