import { useCallback, useState } from 'react';
import { LayoutAnimation } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

/**
 * A boolean whose flips animate the resulting layout change with LayoutAnimation.
 * The change is instant while Reduce Motion is on or the system has not answered yet.
 */
export function useLayoutToggle(initial = false): [boolean, () => void] {
  const [open, setOpen] = useState(initial);
  const reduceMotion = useReduceMotion();

  const toggle = useCallback(() => {
    if (reduceMotion === false) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((value) => !value);
  }, [reduceMotion]);

  return [open, toggle];
}
