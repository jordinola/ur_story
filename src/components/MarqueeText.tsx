import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';

/** Scroll speed in points per second. Slow enough for a child to read along. */
const SPEED = 30;
export const MARQUEE_PAUSE_MS = 1500;
/** Extra travel so the last letter clears the edge before the loop restarts. */
export const MARQUEE_GAP = 16;
/** Wide enough that the measuring text never wraps; titles are far shorter. */
const TRACK_WIDTH = 4000;

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Single-line text that scrolls sideways, but only when it is cut off and the
 * user has not asked for Reduce Motion. Otherwise it shows a normal ellipsis.
 * Use it for one focused item (like the mini-player), never for a whole list.
 */
export function MarqueeText({ children, style }: Props) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [translateX] = useState(() => new Animated.Value(0));

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

  const distance = textWidth - containerWidth;
  const animating = !reduceMotion && containerWidth > 0 && distance > 0.5;

  useEffect(() => {
    if (!animating) {
      translateX.setValue(0);
      return;
    }
    const travel = distance + MARQUEE_GAP;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(MARQUEE_PAUSE_MS),
        Animated.timing(translateX, {
          toValue: -travel,
          duration: (travel / SPEED) * 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(MARQUEE_PAUSE_MS),
        Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animating, distance, translateX]);

  return (
    <View
      testID="marquee-container"
      style={styles.container}
      onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* In flow so the row keeps its height; hidden while the scrolling copy is shown. */}
      <Text style={[style, { opacity: animating ? 0 : 1 }]} numberOfLines={1}>
        {children}
      </Text>
      {/* Measures the natural text width and does the scrolling. Screen readers use the copy above. */}
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.track, { opacity: animating ? 1 : 0, transform: [{ translateX }] }]}
      >
        <Text
          testID="marquee-track-text"
          style={[style, styles.trackText]}
          numberOfLines={1}
          onLayout={(e: LayoutChangeEvent) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {children}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  track: { position: 'absolute', top: 0, left: 0, width: TRACK_WIDTH, flexDirection: 'row' },
  trackText: { flexShrink: 0 },
});
