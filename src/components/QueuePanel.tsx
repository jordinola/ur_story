import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveUrl } from '../lib/catalog';
import { formatMinutes } from '../lib/format';
import { useQueue } from '../lib/QueueProvider';
import { colors, fonts, radius } from '../theme';
import type { Story } from '../types';

const COVER_SIZE = 40;

function RowCover({ story }: { story: Story }) {
  return (
    <View style={[styles.cover, { backgroundColor: story.color }]}>
      {story.cover ? (
        <Image source={{ uri: resolveUrl(story.cover) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <Text style={styles.emoji} allowFontScaling={false}>
          {story.emoji}
        </Text>
      )}
    </View>
  );
}

/** The queued stories in play order, with icon controls to bump one to the top or drop it. */
export function QueuePanel() {
  const { queue, moveToTop, remove, playNow } = useQueue();

  return (
    <View style={styles.container}>
      <Text style={styles.heading} accessibilityRole="header">
        Up next
      </Text>
      {queue.length === 0 ? (
        <View style={styles.empty}>
          <Text
            style={styles.emptyGlyph}
            allowFontScaling={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            ☰
          </Text>
          <Text style={styles.emptyTitle}>Your queue is empty</Text>
          <Text style={styles.emptyHint}>Press and hold a story, or tap ⋯ on a card, to add it.</Text>
        </View>
      ) : (
        queue.map((story, index) => (
          <View key={story.id} style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.play, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Play ${story.title}`}
              onPress={() => playNow(story.id)}
            >
              <RowCover story={story} />
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>
                  {story.title}
                </Text>
                <Text style={styles.meta}>{formatMinutes(story.durationSec)}</Text>
              </View>
            </Pressable>
            {index > 0 && (
              <Pressable
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={`Move ${story.title} to top`}
                onPress={() => moveToTop(story.id)}
              >
                <Text style={styles.actionText} allowFontScaling={false}>
                  ⤒
                </Text>
              </Pressable>
            )}
            <Pressable
              style={styles.action}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${story.title} from queue`}
              onPress={() => remove(story.id)}
            >
              <Text style={styles.actionText} allowFontScaling={false}>
                ✕
              </Text>
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
  empty: { alignItems: 'center', gap: 6, paddingVertical: 32, paddingHorizontal: 16 },
  emptyGlyph: { fontFamily: fonts.rounded, fontSize: 36, fontWeight: '700', color: colors.muted, marginBottom: 4 },
  emptyTitle: { fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyHint: { fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 6,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  cover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  emoji: { fontSize: 22, textAlign: 'center' },
  play: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.85 },
  info: { flex: 1, paddingVertical: 2 },
  title: { fontFamily: fonts.rounded, fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.muted, marginTop: 2 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.rounded, fontSize: 20, fontWeight: '700', color: colors.primary },
});
