import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the user asked the system to reduce motion. `undefined` until the
 * system has answered, so callers can wait instead of starting an animation
 * they would immediately have to stop.
 */
export function useReduceMotion(): boolean | undefined {
  const [reduceMotion, setReduceMotion] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
