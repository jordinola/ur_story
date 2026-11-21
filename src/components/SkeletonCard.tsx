import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../lib/useReduceMotion';
import { colors, radius } from '../theme';

const COVER_RATIO = 0.78;
const PULSE_MS = 900;

type Props = {
  width: number;
  /** Announced to screen readers. Give it to one card in a group so loading is read out once. */
  label?: string;
};

/** Placeholder with the same shape as a story card, shown while stories load. */
export function SkeletonCard({ width, label }: Props) {
  const reduceMotion = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    // Wait for the system's answer, and hold still if the user asked for less motion.
    if (reduceMotion !== false) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [reduceMotion, opacity]);

  const a11y = label
    ? ({ accessible: true, accessibilityRole: 'progressbar', accessibilityLabel: label } as const)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);

  return (
    <Animated.View testID="skeleton-card" style={[styles.card, { width, opacity }]} {...a11y}>
      <View style={[styles.block, { height: width * COVER_RATIO }]} />
      <View style={styles.body}>
        <View style={[styles.block, styles.titleLine]} />
        <View style={[styles.block, styles.titleLine, styles.titleShort]} />
        <View style={[styles.block, styles.metaLine]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  block: { backgroundColor: colors.border },
  body: { padding: 12, gap: 8 },
  titleLine: { height: 14, borderRadius: radius.sm },
  titleShort: { width: '60%' },
  metaLine: { height: 11, width: '45%', borderRadius: radius.sm },
});
