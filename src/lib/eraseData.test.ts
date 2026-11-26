import AsyncStorage from '@react-native-async-storage/async-storage';
import { eraseAllData } from './eraseData';
import { removeAllDownloads } from './downloadStore';

jest.mock('./downloadStore', () => ({ removeAllDownloads: jest.fn() }));

const removeDownloads = jest.mocked(removeAllDownloads);

beforeEach(async () => {
  await AsyncStorage.clear();
  removeDownloads.mockReset();
});

describe('eraseAllData', () => {
  it('removes every storytime key, keeps other keys and removes the downloads', async () => {
    await AsyncStorage.multiSet([
      ['storytime:profiles:v1', '{}'],
      ['storytime:library:v2', '{}'],
      ['other:key', 'keep'],
    ]);

    await eraseAllData();

    expect(await AsyncStorage.getAllKeys()).toEqual(['other:key']);
    expect(removeDownloads).toHaveBeenCalledTimes(1);
  });

  it('resolves when nothing is stored', async () => {
    await expect(eraseAllData()).resolves.toBeUndefined();
    expect(removeDownloads).toHaveBeenCalledTimes(1);
  });

  it('still removes the downloads and rejects when clearing storage fails', async () => {
    await AsyncStorage.setItem('storytime:profiles:v1', '{}');
    jest.spyOn(AsyncStorage, 'multiRemove').mockRejectedValueOnce(new Error('disk full'));

    await expect(eraseAllData()).rejects.toThrow('Could not erase all data');
    expect(removeDownloads).toHaveBeenCalledTimes(1);
  });

  it('still clears storage and rejects when removing the downloads fails', async () => {
    await AsyncStorage.setItem('storytime:profiles:v1', '{}');
    removeDownloads.mockImplementation(() => {
      throw new Error('busy');
    });

    await expect(eraseAllData()).rejects.toThrow('Could not erase all data');
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
