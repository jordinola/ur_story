import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { resolveUrl } from '../lib/catalog';
import { formatMinutes } from '../lib/format';
import { colors, radius } from '../theme';
import type { Story } from '../types';

const TITLE_LINES = 2;
const TITLE_LINE_HEIGHT = 21;

type Props = {
  story: Story;
  width: number;
  favorite: boolean;
  completed: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
};

export function StoryCard({ story, width, favorite, completed, onPress, onToggleFavorite }: Props) {
  const { fontScale } = useWindowDimensions();
  // Always reserve two lines (scaled for Dynamic Type) so every card in the grid has the same height.
  const titleMinHeight = TITLE_LINES * TITLE_LINE_HEIGHT * fontScale;

  return (
    <View style={{ width }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${story.title}, ${formatMinutes(story.durationSec)}`}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.cover, { backgroundColor: story.color, height: width * 0.78 }]}>
          {story.cover ? (
            <Image source={{ uri: resolveUrl(story.cover) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Text style={[styles.emoji, { fontSize: width * 0.38 }]}>{story.emoji}</Text>
          )}
          {completed ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✓ Listened</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { minHeight: titleMinHeight }]} numberOfLines={TITLE_LINES}>
            {story.title}
          </Text>
          <Text style={styles.meta}>
            {formatMinutes(story.durationSec)} · Ages {story.ageRange}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggleFavorite}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
        style={styles.heart}
      >
        <Text style={[styles.heartText, { color: favorite ? colors.heart : colors.muted }]}>
          {favorite ? '♥' : '♡'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { alignItems: 'center', justifyContent: 'center' },
  emoji: { textAlign: 'center' },
  body: { padding: 12, gap: 4 },
  title: { fontSize: 16, lineHeight: TITLE_LINE_HEIGHT, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartText: { fontSize: 20, lineHeight: 24 },
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
