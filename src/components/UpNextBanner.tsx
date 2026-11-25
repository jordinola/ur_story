import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueue } from '../lib/QueueProvider';
import { colors, fonts, radius } from '../theme';

/** Text-only countdown shown while the next queued story is about to start. */
export function UpNextBanner() {
  const { upNext, gapRemainingSec, cancelUpNext } = useQueue();

  if (!upNext || gapRemainingSec == null) return null;

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.text} numberOfLines={2}>
        {`Up next: ${upNext.title} in ${gapRemainingSec}`}
      </Text>
      <Pressable
        style={styles.cancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel up next"
        onPress={cancelUpNext}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  text: { flex: 1, fontFamily: fonts.rounded, fontSize: 15, fontWeight: '600', color: colors.text },
  cancel: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  cancelText: { fontFamily: fonts.rounded, fontSize: 15, fontWeight: '700', color: colors.primary },
});
