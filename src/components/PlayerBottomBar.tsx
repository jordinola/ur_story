import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

type PlayerBottomBarProps = {
  queueOpen: boolean;
  onToggleQueue: () => void;
  onOpenMore: () => void;
};

/** Icon-only bar pinned under the story screen: Queue and More, centered as a pair. */
export function PlayerBottomBar({ queueOpen, onToggleQueue, onOpenMore }: PlayerBottomBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="player-bottom-bar"
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          paddingLeft: Math.max(insets.left, 20),
          paddingRight: Math.max(insets.right, 20),
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Queue"
        accessibilityState={{ selected: queueOpen }}
        onPress={onToggleQueue}
        style={styles.btn}
      >
        <Text style={[styles.glyph, queueOpen && styles.glyphActive]} allowFontScaling={false}>☰</Text>
        {queueOpen ? <View testID="queue-active-indicator" style={styles.dot} /> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={onOpenMore} style={styles.btn}>
        <Text style={styles.glyph} allowFontScaling={false}>•••</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 64,
    paddingTop: 4,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  btn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: fonts.rounded, fontSize: 22, fontWeight: '700', color: colors.muted },
  dot: { position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  glyphActive: { color: colors.primary },
});
