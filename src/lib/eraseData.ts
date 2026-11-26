import AsyncStorage from '@react-native-async-storage/async-storage';
import { removeAllDownloads } from './downloadStore';

// Every key the app writes is namespaced with this prefix, so new keys are covered without a list.
const STORAGE_PREFIX = 'storytime:';

const clearStoredState = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(STORAGE_PREFIX)));
};

// Both steps always run: a failure in one must not leave the other half of the data behind.
export async function eraseAllData(): Promise<void> {
  const steps = await Promise.allSettled([clearStoredState(), Promise.resolve().then(removeAllDownloads)]);
  if (steps.some((step) => step.status === 'rejected')) throw new Error('Could not erase all data');
}
