import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useLibrary } from '../lib/LibraryProvider';

/** Upper bound for holding the splash screen, so a stalled load can never leave the app stuck on it. */
export const SPLASH_TIMEOUT_MS = 4000;

/**
 * Hides the native splash screen as soon as the library has content to show.
 * Renders nothing. The splash is kept up by `preventAutoHideAsync` in the root layout.
 */
export function SplashGate() {
  const { ready, stories } = useLibrary();
  const hasContent = ready && stories.length > 0;

  useEffect(() => {
    if (hasContent) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const timer = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasContent]);

  return null;
}
