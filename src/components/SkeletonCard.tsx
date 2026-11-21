import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../lib/useReduceMotion';
import { cardShadow, colors, radius } from '../theme';
import { COVER_INSET, COVER_RATIO } from './StoryCard';

const PULSE_MS = 900;

type Props = {
  width: number;
  /** Match the shorter landscape cover used by story cards. */
  landscape?: boolean;
  /** Announced to screen readers. Give it to one card in a group so loading is read out once. */
  label?: string;
};

/** Placeholder with the same shape as a story card, shown while stories load. */
export function SkeletonCard({ width, landscape = false, label }: Props) {
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
    // Same structure as StoryCard: shadow on the outer view, clipping on the inner one.
    <Animated.View testID="skeleton-card" style={[styles.card, cardShadow, { width, opacity }]} {...a11y}>
      <View style={styles.clip}>
        <View
          testID="skeleton-cover"
          style={[
            styles.block,
            styles.cover,
            { height: width * (landscape ? COVER_RATIO.landscape : COVER_RATIO.portrait) },
          ]}
        />
        <View style={styles.body}>
          <View style={[styles.block, styles.titleLine]} />
          <View style={[styles.block, styles.titleLine, styles.titleShort]} />
          <View style={[styles.block, styles.metaLine]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl },
  clip: { borderRadius: radius.xl, overflow: 'hidden', padding: COVER_INSET },
  block: { backgroundColor: colors.border },
  cover: { borderRadius: radius.xl - COVER_INSET },
  body: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6, gap: 8 },
  titleLine: { height: 14, borderRadius: radius.sm },
  titleShort: { width: '60%' },
  metaLine: { height: 11, width: '45%', borderRadius: radius.sm },
});
