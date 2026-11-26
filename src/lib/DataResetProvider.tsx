import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, View } from 'react-native';
import { eraseAllData } from './eraseData';
import { resetToHome } from './navigation';
import { colors } from '../theme';

type DataResetContextValue = {
  /** Erases everything the app saved and restarts it at home. Never rejects: a failure shows an alert. */
  eraseEverything: () => Promise<void>;
};

const DataResetContext = createContext<DataResetContextValue | null>(null);

// Providers hold their saved state in memory, so wiping storage alone would let them write it back.
// The tree is unmounted first (players released, downloads cancelled), erased, then mounted fresh.
export function DataResetProvider({ children }: { children: ReactNode }) {
  const [erasing, setErasing] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const settle = useRef<(() => void) | null>(null);
  const failed = useRef(false);

  // After the fresh tree is back: an alert shown earlier would fight the native screen teardown.
  useEffect(() => {
    if (!failed.current) return;
    failed.current = false;
    Alert.alert('Could not erase everything', 'Please try again.');
  }, [epoch]);

  // An effect runs after the commit that removed the children, so their cleanups have already run.
  useEffect(() => {
    if (!erasing) return;
    eraseAllData()
      .catch(() => {
        failed.current = true;
      })
      .finally(() => {
        setEpoch((value) => value + 1);
        setErasing(false);
        settle.current?.();
        settle.current = null;
      });
  }, [erasing]);

  const eraseEverything = useCallback(() => {
    if (settle.current) return Promise.resolve();
    const done = new Promise<void>((resolve) => {
      settle.current = resolve;
    });
    // Close the open screens while the navigator still exists; the remounted tree then starts at home.
    resetToHome();
    setErasing(true);
    return done;
  }, []);

  const value = useMemo(() => ({ eraseEverything }), [eraseEverything]);

  return (
    <DataResetContext.Provider value={value}>
      {erasing ? (
        <View testID="data-reset-cover" style={{ flex: 1, backgroundColor: colors.bg }} />
      ) : (
        <Fragment key={epoch}>{children}</Fragment>
      )}
    </DataResetContext.Provider>
  );
}

export function useDataReset(): DataResetContextValue {
  const value = useContext(DataResetContext);
  if (!value) throw new Error('useDataReset must be used inside DataResetProvider');
  return value;
}
