import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMinutes } from '../lib/format';
import { useQueue } from '../lib/QueueProvider';
import { colors, fonts, radius } from '../theme';

/** The queued stories in play order, with controls to bump one to the top or drop it. */
export function UpNextList() {
  const { queue, moveToTop, remove } = useQueue();

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityRole="header">
        Up next
      </Text>
      {queue.length === 0 ? (
        <Text style={styles.empty}>Nothing queued. Press and hold a story to add it.</Text>
      ) : (
        queue.map((story, index) => (
          <View key={story.id} style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={2}>
                {story.title}
              </Text>
              <Text style={styles.meta}>{formatMinutes(story.durationSec)}</Text>
            </View>
            {index > 0 && (
              <Pressable
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={`Move ${story.title} to top`}
                onPress={() => moveToTop(story.id)}
              >
                <Text style={styles.actionText}>Move to top</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${story.title} from queue`}
              onPress={() => remove(story.id)}
            >
              <Text style={styles.actionText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  heading: { fontFamily: fonts.rounded, fontSize: 20, fontWeight: '800', color: colors.text },
  empty: { fontSize: 15, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  info: { flex: 1, paddingVertical: 8 },
  title: { fontFamily: fonts.rounded, fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontFamily: fonts.rounded, fontSize: 14, fontWeight: '700', color: colors.primary },
});
